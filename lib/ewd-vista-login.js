/* Set-up module.export.handlers structure */
let vista = require('ewd-vista');

module.exports          = {};
module.exports.handlers = {};

/* Sets up Symbol Table management
 * Called when module is loaded by QEWD */
module.exports.init = function() {
  vista.init.call(this);
};

/* Called next - Call XUS SIGNON SETUP and then check INHIB1 and INHIB2 in ^XUSRB */
module.exports.handlers.isLogonInhibited = function(messageObj, session, send, finished) {

  // IP Address and Client Name for VistA (works for both GT.M and Cache)
  this.db.symbolTable.restore(session);
  this.db.symbolTable.setVar('XWBTIP', session.ipAddress);
  this.db.symbolTable.setVar('XWBCLMAN', this.db.version());
  var params = { rpcName: 'XUS SIGNON SETUP' };
  // don't load and throwaway symbol table yet. We want it for the next call
  // (third parameter to manage symbol table in RPC is false)
  var response = runRPC.call(this, params, session, false);

  var isLogOnProhibited  = parseInt(this.db.function({function: 'INHIB1^XUSRB'}).result);
  var isMaxUsersOnSystem = parseInt(this.db.function({function: 'INHIB2^XUSRB'}).result);
  //
  // Now save the symbol table, and then clear it for this process.
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

  var postSignInText = '';

  var i;
  for(i = 6; i < values.length, values[i] !== ''; i++) {
    postSignInText += values[i] + '\n';
  }

  // The good morning/afteroon Sam bit...
  var goodAfternoonMs = values[++i];

  // Get display name from the morning/afteroon message
  var pieces = goodAfternoonMs.split(' ');
  pieces = pieces.splice(2, pieces.length);
  var displayName = pieces.join(' ');

  // You last signed on ...
  var lastSignon = values[++i];
  var mailAndMore = values.splice(++i, values.length);

  // What are we sending back?
  var results = {
    displayName: displayName,
    postSignInText: postSignInText,
    greeting: goodAfternoonMs,
    cvc: cvc,
    lastSignon: lastSignon,
    messages: mailAndMore
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

  // Load configuration
  if (this.handlers['ewd-vista'].isConfigOptionSetSync('ewd-vista-login', 'upper-case-vc')) {
    oldVC = oldVC.toUpperCase();
    newVC1 = newVC1.toUpperCase();
    newVC2 = newVC2.toUpperCase();
  }

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
module.exports.handlers.logout = function(messageObj, session, send, finished) {
  this.db.symbolTable.restore(session);

  //NB: Else if for Cache as we don't have the proedure API yet
  if (this.db.procedure) this.db.procedure({procedure: 'LOGOUT^XUSRB'});
  else this.db.function({function: 'D^ewdVistAUtils', arguments: ['LOGOUT^XUSRB']});
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

