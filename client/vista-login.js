let clientMethods = {};

/* Call to see if we can log on */
clientMethods.preLogin1 = function(EWD) {
  let messageObj = {
    service: 'ewd-vista-login',
    type: 'isLogonInhibited'};
  EWD.send(messageObj, function(responseObj2) {
    clientMethods.preLogin2(responseObj2, EWD);
  });
};

/* Handle reply from isLogonInhibited */
clientMethods.preLogin2 = function(responseObj, EWD) {
  if (responseObj.message.isLogOnProhibited)
  {
    $('#modal-window').html('<h1>Log-ons are Prohibited.</h1>').removeClass('modal').removeClass('fade').addClass('jumbotron');
    return;
  }
  if (responseObj.message.isMaxUsersOnSystem)
  {
    $('#modal-window').html('<h1>No more users are allowed on the system.</h1>').removeClass('modal').removeClass('fade').addClass('jumbotron');
    return;
  }

  let params = {
    service: 'ewd-vista-login',
    name: 'login.html',
    targetId: 'modal-window'
  };
  EWD.getFragment(params, function() {
    clientMethods.login(EWD);
  });
};

// Called from getFragment in preLogin2.
clientMethods.login = function(EWD) {
  // Handle click of Login Button
  $('#loginBtn').on('click', function(e) {
    let ac = $('#username').val();
    let vc = $('#password').val();
    if (ac === '' || vc === '')
    {
      toastr.options.target = '#modal-dialog';
      toastr.error('Must enter both access and verify codes');
      return;
    }

    let messageObj = {
      service: 'ewd-vista-login',
      type: 'login',
      params: {
        ac: ac,
        vc: vc
      }
    };
    EWD.send(messageObj, function(responseObj) {
      clientMethods.loggingIn(responseObj, EWD);
    });
  });

  // Handle enter and escape keys
  $(document).on('keydown', function(event){
    // Set up Return key
    if (event.keyCode === 13) {
      $('#loginBtn').click();
    }
    // Set up Esc key
    if (event.keyCode === 27) {
      clientMethods.logout(EWD);
    }
  });

  // Focus on user name when form shows
  $('#modal-window').one('shown.bs.modal', function() {
    $('#username').focus();
  });

  // Finally, show form
  $('#loginBtn').show();
  $('#modal-window').modal('show');
  
  // Auto-fill if in development mode
  let messageObj = {
    service: 'ewd-vista',
    type: 'getMode'
  };
  EWD.send(messageObj, function(responseObj) {
    let mode = responseObj.message.mode;
    if (mode === 'development') {
      let messageObj = {
        service: 'ewd-vista',
        type: 'getFixtures',
        params: {
          module: 'ewd-vista-login'
        }
      };
      EWD.send(messageObj, function(responseObj) {
        let user = responseObj.message.fixtures.user;
        if (typeof user === 'undefined') return;
        if (user.accessCode && user.verifyCode) {
          $('#username').val(user.accessCode);
          $('#password').val(user.verifyCode);
          $('#loginBtn').click();
        }
      });
    }
  });
  
  // Load into message last so user's aren't required to wait for it
  messageObj = {
    service: 'ewd-vista-login',
    type: 'RPC',
    params: {
      rpcName: 'XUS INTRO MSG'
    }
  };

  EWD.send(messageObj, function(responseObj) {
    let arr = [];
    for (let i in responseObj.message.value)
    {
      arr.push(responseObj.message.value[i]);
    }
    $('#login-intro').html('<pre>' + arr.join('\n') + '</pre>');
  });
};

// This is what happens after we send the ac/vc to VISTA.
// responseObj contains the greeting or the error message.
// Invoked by click handler from log-in form above.
clientMethods.loggingIn = function(responseObj, EWD) {
  EWD.emit('loginStatus', responseObj);

  // Handle that we can't log in!
  if (responseObj.message.error) {
    toastr.options.target = '#modal-dialog';
    toastr.error(responseObj.message.error);

    return;
  }

  // Otherwise, say that we are good to go.
  toastr.options.allowHtml = true; // For multi-line post message
  let postSignInText = responseObj.message.postSignInText.replace(/\n/g, '<br />');
  let greeting = responseObj.message.greeting;
  let lastSignon = responseObj.message.lastSignon;

  if (postSignInText) toastr.success(postSignInText);
  toastr.success(greeting);
  toastr.info(lastSignon);

  // If user wants to change verify code, load that dialog,
  // and branch to it; or if Verify Code Change is required.
  if($('#chkChangeVerify').is(':checked') || responseObj.message.cvc) {
    toastr.warning('Verify Code Must be Changed!');

    $('#modal-window').one('hidden.bs.modal', function() {
      let params = {
        service: 'ewd-vista-login',
        name: 'cvc.html',
        targetId: 'modal-window',
      };
      // Password is closured for its own protection.
      EWD.getFragment(params, function (oldPassword) {
        return function () {
          clientMethods.showCVC(oldPassword, EWD);
        };
      }($('#password').val()));
    });

    $('#modal-window').modal('hide');
  }
  // Otherwise (no change verify code), select division on hide event
  else {
    $('#modal-window').one('hidden.bs.modal', function() {
      clientMethods.selectDivision(EWD);
    });

    $('#modal-window').modal('hide');
  }
};

/* Show change verify code form */
/* You will think that I am crazy to implement the VISTA VC code logic
   here. Yes. I found that CVC^XUSRB kills DUZ if you send it the incorrect
   verify code change. So I had to take tons of precautions so that
   that won't happen. That includes doing all the verify code checking
   at the client side. */
clientMethods.showCVC = function(oldPassword, EWD) {
  // Unbind keydown and modal button event handlers
  $(document).off('keydown');
  $('#modal-window button').off();

  // Focus on user name when form shows
  $('#modal-window').one('shown.bs.modal', function() {
    $('#oldVC').val(oldPassword); // Put the old password here
    $('#oldVC').attr('disabled', true); // and disable the control
    $('#newVC1')[0].focus(); // focus on new verify code.
  });

  $('#modal-window').modal('show');

  // Change Verify Code event handling
  $('#cvcChangeBtn').on('click', function(e){
    let oldVC = $('#oldVC').val();
    let newVC1 = $('#newVC1').val();
    let newVC2 = $('#newVC2').val();
    toastr.options.target = '#modal-window';
    if (newVC1 !== newVC2)
    {
      toastr.error('New Verify Codes don\'t match');
      return;
    }
    if (newVC1.length < 8)
    {
      toastr.error('Verify Code must be longer than 8 characters');
      return;
    }

    /* Thank you Stack Overflow for this! */
    let hasAlpha = (/[A-Za-z]+/).test(newVC1),
      hasNumber = (/[0-9]+/).test(newVC1),
      specials = (/[^A-Za-z0-9]+/).test(newVC1);
    if (hasAlpha && hasNumber && specials) {
      console.log('Old verify code: ' + oldVC);
      clientMethods.doCVC(oldVC, newVC1, newVC2, EWD);
    }
    else {
      /* Message taken from XUSRB */
      toastr.error('Enter 8-20 characters any combination of alphanumeric-punctuation');
      return;
    }
  });

  // Cancel Change -- just log-out.
  $('#cvcCancelBtn').one('click', function(event){
    $('#modal-window').modal('hide');
    clientMethods.logout(EWD);
  });

  // Handle enter and escape.
  $(document).on('keydown', function(event){
    if (event.keyCode === 13) {
      $('#cvcChangeBtn').click();
    }
    if (event.keyCode === 27) {
      $('#cvcCancelBtn').click();
    }
  });
};

// Change verify code action. Called from form immediately above.
clientMethods.doCVC = function(oldVC, newVC1, newVC2, EWD) {
  let messageObj = {
    service: 'ewd-vista-login',
    type: 'cvc',
    params: {
      oldVC: oldVC,
      newVC1: newVC1,
      newVC2: newVC2
    }
  };

  EWD.send(messageObj, function(responseObj) {
    clientMethods.CVCPost(responseObj, EWD);
  });
};

/* Verify code Change message from cvc call. Just say if we succceeded,
 * or log-out if we failed (we don't have any other choice b/c of the
 * dirty logic in XUSRB). */
clientMethods.CVCPost = function(responseObj, EWD) {
  if (responseObj.message.ok) {
    $('#modal-window').one('hidden.bs.modal', function() {
      clientMethods.selectDivision(EWD);
    });
    toastr.success('Verify Code changed');
  }
  else {
    $('#modal-window').one('hidden.bs.modal', function() {
      clientMethods.logout(EWD);
    });
    toastr.error(responseObj.message.error);
  }

  $('#modal-window').modal('hide');
};

// Modal pane to select division when loggin in.
// XUS DIVISION GET will set the division if there are zero or one divisions
// available for the user. We don't need to call XUS DIVISION SET to set the
// division. If there is more than one, supply user's choice to XUS DIVISON SET.
clientMethods.selectDivision = function(EWD) {
  // Unbind keydown and modal button event handlers
  $(document).off('keydown');
  $('#modal-window button').off();

  let messageObj = {
    service: 'ewd-vista-login',
    type: 'RPC',
    params: {
      rpcName: 'XUS DIVISION GET'
    }
  };

  EWD.send(messageObj, function(responseObj) {
    responseObj.message.value.splice(0,1); // Remove array length element

    let divisions = [];
    responseObj.message.value.forEach(function(element, index, array) {
      element = element.split('^');

      let division     = {};
      division.ien     = element[0];
      division.name    = element[1];
      division.code    = element[2];
      division.default = ((element[3] == 1) ? true : false);

      divisions.push(division);
    });

    // We are done with selecting division if selectable list is 0. Move to next task.
    if (divisions.length == 0) {
      clientMethods.setContext(EWD);
    }
    // Ask a user to select a division.
    else if (divisions.length > 0) {
      let params = {
        service: 'ewd-vista-login',
        name: 'division.html',
        targetId: 'modal-window',
      };

      EWD.getFragment(params, function() {
        // Build division list; and mark default and enable OK if VISTA has a default assigned.
        let optionsHtml = '';
        divisions.forEach(function(element, index, array) {
          optionsHtml = optionsHtml + '<option value="' + element.ien + '"';
          if (element.default) {
            optionsHtml = optionsHtml + ' selected';
            $('#ok-button').removeAttr('disabled'); // Enable OK button
          }
          optionsHtml = optionsHtml   + '>' + element.name + '  (' + element.code + ')' + '</option>';
        });

        // Populate select with options
        $('#division').append(optionsHtml);
        $('#division').change(function() {
          // if user selects an item, enable Ok button in case there is no default division
          $('#ok-button').removeAttr('disabled');
        });

        // Set up buttons
        $('#ok-button').one('click', function(e) {
          let ien = $('#division').val();

          $('#modal-window').one('hidden.bs.modal', function() {
            clientMethods.setDivision(ien, EWD);
          });

          $('#modal-window').modal('hide');
        });
        $('#cancel-button').one('click', function(e) {
          clientMethods.logout(EWD);
        });
        // Handle return and escape keys
        $(document).one('keydown', function(event){
          // Set up Return key
          if (event.keyCode === 13) {
            $('#ok-button').click();
          }
          // Set up Esc key
          if (event.keyCode === 27) {
            $('#cancel-button').click();
          }
        });

        $('#modal-window').one('shown.bs.modal', function() {
          EWD.emit('setDivisionReady');
        });

        // Show divisions modal
        $('#modal-window .btn').show();
        $('#modal-window').modal('show');
        
        // Auto-click if in development mode
        let messageObj = {
          service: 'ewd-vista',
          type: 'getMode'
        };
        EWD.send(messageObj, function(responseObj) {
          let mode = responseObj.message.mode;
          if (mode === 'development') {
            $('#ok-button').click();
          }
        });
      });
    }
  }); // EWD.send
}; // VISTA.selectDivision

// Sets division if necessary. Called from selectDivision
clientMethods.setDivision = function(ien, EWD) {
  let messageObj = {
    service: 'ewd-vista-login',
    type: 'RPC',
    params: {
      rpcName: 'XUS DIVISION SET',
      rpcArgs: [{
        type: 'LITERAL',
        value: '`' + ien
      }]
    }
  };
  // If setting the division fails, close the application
  EWD.send(messageObj, function(responseObj){
    EWD.emit('setDivisionStatus', responseObj);

    if (responseObj.message.value != 1) {
      toastr.error('Failed to set division');
      clientMethods.logout(EWD);
    }

    clientMethods.setContext(EWD);
  });
};

/* Create Context Call -- Right now, hardcoded to OR CPRS GUI CHART */
/* TODO: Get rid of this. */
/* I will be getting rid of clientMethods as I want to get rid of setting
 * context on the client side. I want it dealt with transparently on the
 * server side. */
clientMethods.setContext = function(EWD) {
  $('#modal-window').modal('hide');

  let messageObj = {
    service: 'ewd-vista-login',
    type: 'RPC',
    params: {
      rpcName: 'XWB CREATE CONTEXT',
      rpcArgs: [{
        type: 'LITERAL',
        value: 'OR CPRS GUI CHART'
      }]
    }
  };

  // If we can't set the context, close the application
  EWD.send(messageObj, function(responseObj){
    EWD.emit('setContextStatus', responseObj);

    if (responseObj.message.value != 1) {
      toastr.error(responseObj.message.value);
      clientMethods.logout(EWD);
    }
    else {
      clientMethods.showNav(EWD);
    }
  });
};

/* Log out functionality */
clientMethods.logout = function(EWD) {
  toastr.info('Logging Out!');

  params ={
    service: 'ewd-vista-login',
    type: 'logout'
  };
  EWD.send(params, function() {
    EWD.disconnectSocket();
    location.reload();
  });
};

/* ---------------- */
/* THIS IS THE FIRST NON-LOGIN RELATED FUNCTION */

/* Shows navbar and associates the logout button */
clientMethods.showNav = function (EWD) {
  $('#symbols-button').one('click', function() {
    clientMethods.showSymbolTable(EWD);
  });
  $('#logout-button').one('click', function() {
    clientMethods.logout(EWD);
  });

  clientMethods.showUserInfo(EWD);
};

// Get symbol table from server (Button on Navbar)
clientMethods.showSymbolTable = function(EWD) {
  // Unbind keydown and modal button event handlers
  $(document).off('keydown');
  $('#modal-window button').off();

  // Load into message last so user's aren't required to wait for it
  let messageObj = {
    service: 'ewd-vista-login',
    type: 'RPC',
    params: { rpcName: 'ORWUX SYMTAB' }
  };

  EWD.send(messageObj, function(responseObj) {
    let symbolTable = responseObj.message.value;

    // Fix structure of symbol table object
    let jsonSymbolTable = {};
    let keys = Object.keys(symbolTable);
    for (let i=0; i<keys.length; i=i+2) {
      jsonSymbolTable[symbolTable[keys[i]]] = symbolTable[keys[i + 1]];
    }
    // Convert object to text
    let symbolTableHtml = JSON.stringify(jsonSymbolTable, null, 1);
    // Remove outer braces and whitespace
    symbolTableHtml = symbolTableHtml.slice(2,-1);
    /*
    Fix format based on what Mumps programmers will expect to see and hope for
    the absence of inconvenient patterns in variable values
    */
    symbolTableHtml = symbolTableHtml.replace(/^\s'/,'');
    symbolTableHtml = symbolTableHtml.replace(/.\n\s'/g,'\n\n');
    symbolTableHtml = symbolTableHtml.replace(/': /g, '=');
    symbolTableHtml = symbolTableHtml.replace(/\\'/g, '');

    let params = {
      service: 'ewd-vista-login',
      name: 'symbol-table.html',
      targetId: 'modal-window',
    };

    EWD.getFragment(params, function() {
      // Render symbol table
      $('#symbol-table').append(symbolTableHtml);

      $('#modal-window').on('hidden.bs.modal', function() {
        $('#symbols-button').one('click', function() {
          clientMethods.showSymbolTable(EWD);
        });
      });

      // Set up button to dismiss modal
      $('#ok-button').one('click', function() {
        $('#modal-window').modal('hide');
      });

      $(document).one('keydown', function(event) {
        if ((event.keyCode === 13) || (event.keyCode === 27)) {
          $('#ok-button').click();
        }
      });

      $('#modal-window').one('shown.bs.modal', function() {
        EWD.emit('showSymbolTableStatus', responseObj);
      });

      // Show modal
      $('#modal-window .btn').show();
      $('#modal-window').modal('show');
    });
  });
};

// Get user info
clientMethods.showUserInfo = function(EWD) {
  let messageObj = {
    service: 'ewd-vista-login',
    type: 'RPC',
    params: {
      rpcName: 'XUS GET USER INFO'
    }
  };
  EWD.send(messageObj, function(responseObj) {
    EWD.emit('showUserInfoStatus', responseObj);

    let info = responseObj.message.value;

    // Start loading modules
    clientMethods.loadModules(info[0], EWD);

    // List user name in nav
    $('#user-name').prepend(info[1]);
    // Build user info
    $('#user-duz').append(info[0]);
    $('#user-fullname').append(info[2]);
    $('#user-title').append(info[4]);
    $('#user-division').append(info[3].split('^')[1]);
    $('#user-service').append(info[5]);
    $('#user-language').append(info[6]);
    $('#user-dtime').append(info[7] + ' s');

    $('#navbar').removeClass('invisible');

    // Use DTIME to set session timeout
    clientMethods.setTimeout(info[7], EWD);
  });
};

clientMethods.setTimeout = function(sessionTimeout, EWD) {
  let messageObj = {
    service: 'ewd-vista-login',
    type: 'setTimeout',
    params: {
      timeout: sessionTimeout
    }
  };
  EWD.send(messageObj, function(responseObj) {
    EWD.emit('setTimeoutStatus', responseObj);
  });
};

// Sam sez: I think this is the most complex piece of code in Panorama
// There are several objectives I have in this code:
// - Late binding. Don't load the js and css until the user clicks.
//   That now works.
// - Early binding for services: Load services early. Right now, I am
//   hardcoding the location for Fileman. I don't like that. TODO
// - Easy naming conventions. Waay to broken right now. Lots of names
//   for things (name, htmlName, module). TODO
// - Avoid naming collisions. I am just getting started, so I don't know.
clientMethods.loadModules = function(duz, EWD) {
  // Dynamically load the other VistA modules for which the user has
  // correct security keys
  let messageObj = {
    service: 'ewd-vista',
    type: 'getAuthorizedModules',
    params: { duz: duz }
  };
  EWD.send(messageObj, function(responseObj) {
    let modulesData = responseObj.message.modulesData;
    $.getScript('assets/javascripts/vista-fileman.js', function(){
      fileman.defineWidgets(EWD);

      modulesData.forEach(function(element) {
        // Nothing to load for service modules
        if (element.service) return true;
        // Load client "module"
        // TODO: Change this to be the same name as the javascript file resolution code
        // Add to menu -- will need to more elaborate when we have nested
        // modules. And attach prep function to click.
        $('#apps-menu .dropdown-menu').append('<li><a href="#" id="app-' + element.htmlName + '">' + element.name + '</a></li>');
        $('#app-' + element.htmlName).click(function(e) {
          $('head').append('<link rel="stylesheet" href="assets/stylesheets/' + element.htmlName + '.css">');
          $.getScript('assets/javascripts/' + element.module.replace('ewd-', '') + '.js', function(){
            vista.switchApp(element.module.replace('ewd-',''));
            window[element.clientModuleName].prep(EWD);
          });
        });
      });
    });
  });
};

module.exports = clientMethods;
