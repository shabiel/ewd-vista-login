// In honor of VistA developers
String.prototype.piece = function(num, delimiter) {
  if (typeof delimiter === 'undefined') delimiter='^';
  return this.split(delimiter)[num-1];
};
String.prototype.$p = String.prototype.piece;
String.prototype.$P = String.prototype.piece;

/* Two needed imports */
var sessions = require('ewd-session');
var runRPC   = require('ewd-qoper8-vistarpc/lib/proto/runRPC');

/* Set-up module.export.handlers structure */
module.exports          = {};
module.exports.handlers = {};

/* Sets up Symbol Table management
 * Called at the start of the applciation */
module.exports.handlers.initialise = function(messageObj, session, send, finished) {
  this.db.symbolTable = sessions.symbolTable(this.db);
  finished({ok: true});
};

/* Called next - Call XUS SIGNON SETUP and then check INHIB1 and INHIB2 in ^XUSRB */
module.exports.handlers.isLogonInhibited = function(messageObj, session, send, finished) {
  // %ZIS4 expects this to get the IP address on GT.M. Cache TBD.
  process.env.REMOTEADDR = session.ipAddress;
  var params = {
    rpcName: 'XUS SIGNON SETUP'
  };
  var response = runRPC.call(this, params, session);
  delete process.env.REMOTEADDR;
 
  // Get back the symbol table in order to call INHIB1 & INHIB2.
  this.db.symbolTable.restore(session);
  var isLogOnProhibited  = parseInt(this.db.function({function: 'INHIB1^XUSRB'}).result);
  var isMaxUsersOnSystem = parseInt(this.db.function({function: 'INHIB2^XUSRB'}).result);
  this.db.symbolTable.save(session);
  this.db.symbolTable.clear();
  finished (
    {
      isLogOnProhibited: isLogOnProhibited,
      isMaxUsersOnSystem: isMaxUsersOnSystem
    }
  );
};

/* Wrapper to Call an RPC */
module.exports.handlers.RPC = function(messageObj, session, send, finished) {
  console.log(messageObj);
  finished(runRPC.call(this, messageObj.params, session, true));
};

/* Special code for login. We need to do a lot more work than just an RPC */
module.exports.handlers.login = function(messageObj, session, send, finished) {
  // (Sam): If we are authenticated, just return.
  if (session.authenticated) {
    finished({ok: true});
    return;
  }

  var accessCode = messageObj.params.ac;
  var verifyCode = messageObj.params.vc;
  if (accessCode === '') {
    finished({error: 'You must enter an access code'});
    return;
  }
  if (verifyCode === '') {
    finished({error: 'You must enter a verify code'});
    return;
  }

  var params = {
    rpcName: 'XUS AV CODE',
    rpcArgs: [{
      type: 'LITERAL',
      value: accessCode + ';' + verifyCode
    }],
  };
  
  /*
   *
   * [0,0,1,"VERIFY CODE must be changed before continued use.",0,0,"","Good evening USER,ONE","     You last signed on Aug 21, 2016 at 13:43","There were 2 unsuccessful attempts since you last signed on.","You have 16 new messages. (16 in the 'IN' basket)","","Enter '^NML' to read your new messages.","","Checking POSTMASTER mailbox.","POSTMASTER has 265 new messages. (265 in the 'IN' basket)"]}
   *
   */
  var response = runRPC.call(this, params, session);
  console.log('login response: ' + JSON.stringify(response));
  var values = response.value;
  var duz = parseInt(values[0]);
  var cvc = parseInt(values[2]); // Change verify code!
  var err = values[3];

  // This line is confusing. DUZ == 0 & err not empty an error condition;
  // except that this is valid behavior if the verify code needs to be changed (cvc);
  if (duz == 0 && err != '' && !cvc) {
    finished({error: err});
    return;
  }

  // logged in successfully

  // ** important! flag the user as authenticated to prevent unauthorised access to RPCs by a user before they log in
  session.authenticated = true;
  if (cvc) session.authenticated = false;  // Authenticated = no when CVC. See XUSRB for that.

  var greeting = values[7];
  
  // Get display name
  var pieces = greeting.split(' ');
  pieces = pieces.splice(2, pieces.length);
  var displayName = pieces.join(' ');

  // What are we sending back?
  var results = {
    displayName: displayName,
    greeting: greeting,
    cvc: cvc,
    lastSignon: values[8],
    messages: values.splice(8, values.length)
  };

  // Note that we DON'T return the DUZ!
  finished(results);
};

/* Change Verify Code. Special Code here to authenticate session, as cvc
(above) could have set authenticated to false. */
module.exports.handlers.cvc = function(messageObj, session, send, finished) {
  var oldVC  = messageObj.params.oldVC;
  var newVC1 = messageObj.params.newVC1;
  var newVC2 = messageObj.params.newVC2;

  var params = {
    rpcName: 'XUS CVC',
    rpcArgs: [{
      type: 'LITERAL',
      value: oldVC + '^' + newVC1 + '^' + newVC2
    }]
  };

  var response = runRPC.call(this, params, session, true);
  console.log('cvc response: ' + JSON.stringify(response));

  if((response.value[0]) == 0) {
    session.authenticated = true;
    finished({ok: true});
  }
  else {
    session.authenticated = false;
    finished({error: response.value[1]});
  }
};

/* Log out handler: Clear ST and set authenticated to false */
/* NB: This does not work on Cache yet. Waiting for Intersystems to add Procedure API */
module.exports.handlers.logout = function(messageObj, session, send, finished) {
  this.db.symbolTable.restore(session);
  if (this.db.procedure) this.db.procedure({procedure: 'LOGOUT^XUSRB'});
  this.db.symbolTable.clear();
  session.authenticated = false;
  finished({ok: true});
};

// Set session timeout (based perhaps on DTIME)
module.exports.handlers.setTimeout = function(messageObj, session, send, finished) {
  session.timeout = messageObj.params.timeout;
  session.updateExpiry();
  finished({ok: true});
};
