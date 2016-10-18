/* Initialize ST management then call to see if we can log on */
module.exports.preLogin1 = function(EWD) {
  var messageObj = {
    service: 'ewd-vista-login',
    type: 'initialise'
  }
  EWD.send(messageObj, function(responseObj) {
    var messageObj2 = {
      service: 'ewd-vista-login',
      type: 'isLogonInhibited'};
    EWD.send(messageObj2, this.preLogin2);
  });
}

/* Handle reply from isLogonInhibited */
module.exports.preLogin2 = function(responseObj) {
  if (responseObj.message.isLogOnProhibited)
  {
    $('#modal-window').html('<h1>Log-ons are Prohibited.</h1>')
     .removeClass("modal").removeClass("fade").addClass("jumbotron");
     return;
  }
  if (responseObj.message.isMaxUsersOnSystem)
  {
    $('#modal-window').html('<h1>No more users are allowed on the system.</h1>')
     .removeClass("modal").removeClass("fade").addClass("jumbotron");
     return;
  }

  var params = {
    service: 'ewd-vista-login',
    name: 'login.html',
    targetId: 'modal-window'
  };
  EWD.getFragment(params, this.login); 
}

// Called from getFragment in preLogin2.
module.exports.login = function() {
  // Handle click of Login Button
  $('#loginBtn').on('click', function(e) {
    var ac = $('#username').val();
    var vc = $('#password').val();
    if (ac === '' || vc === '')
    {
      toastr.options.target = '#modal-dialog';
      toastr.error("Must enter both access and verify codes");
      return;
    }

    var messageObj = {
      service: 'ewd-vista-login',
      type: 'login',
      params: {
        ac: ac,
        vc: vc
      }
    };

    EWD.send(messageObj, loggingIn);
  });
  
  // Handle enter and escape keys
  $(document).on('keydown', function(event){
    // Set up Return key
    if (event.keyCode === 13) {
      $('#loginBtn').click();
    }
    // Set up Esc key
    if (event.keyCode === 27) {
      this.logout();
    }
  });
  
  // Focus on user name when form shows
  $('#modal-window').one('shown.bs.modal', function() {
    $('#username').focus();
  });
  
  // Finally, show form
  $('#loginBtn').show();
  $('#modal-window').modal('show');
  
  // Load into message last so user's aren't required to wait for it
  var messageObj = {
    service: 'ewd-vista-login',
    type: 'RPC',
    params: {
      rpcName: 'XUS INTRO MSG'
    }
  };
  
  EWD.send(messageObj, function(responseObj)
  {
    var arr = [];
    for (var i in responseObj.message.value)
    {
      arr.push(responseObj.message.value[i]);  
    }
    $('#login-intro').html("<pre>" + arr.join('\n') + "</pre>");
  });
};

// This is what happens after we send the ac/vc to VISTA.
// responseObj contains the greeting or the error message.
// Invoked by click handler from log-in form above.
module.exports.loggingIn = function(responseObj) {
  // Handle that we can't log in!
  if (responseObj.message.error)
  {
    toastr.options.target = '#modal-dialog';
    toastr.error(responseObj.message.error);
    return;
  }

  // Otherwise, say that we are good to go.
  toastr.success(responseObj.message.greeting);
  
  // If user wants to change verify code, load that dialog,
  // and branch to it; or if Verify Code Change is required.
  if($('#chkChangeVerify').is(':checked') || responseObj.message.cvc) {
    toastr.warning("Verify Code Must be Changed!");
    
    $('#modal-window').one('hidden.bs.modal', function() {
      var params = {
        service: 'ewd-vista-login',
        name: 'cvc.html',
        targetId: 'modal-window',
      };
      // Password is closured for its own protection.
      EWD.getFragment(params, function (oldPassword) {
        return function ()
        {
          this.showCVC(oldPassword);
        };
      }($('#password').val()));
    });
    
    $('#modal-window').modal('hide');
  }
  // Otherwise (no change verify code), select division on hide event
  else {
    $('#modal-window').one('hidden.bs.modal', function() {
      this.selectDivision();
    });
    
    $('#modal-window').modal('hide');
  }
}

/* Show change verify code form */
/* You will think that I am crazy to implement the VISTA VC code logic
   here. Yes. I found that CVC^XUSRB kills DUZ if you send it the incorrect
   verify code change. So I had to take tons of precautions so that
   that won't happen. That includes doing all the verify code checking
   at the client side. */
module.exports.showCVC = function(oldPassword) {
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
    var oldVC = $('#oldVC').val();
    var newVC1 = $('#newVC1').val();
    var newVC2 = $('#newVC2').val();
    toastr.options.target = '#modal-window';
    if (newVC1 !== newVC2)
    {
      toastr.error("New Verify Codes don't match");
      return;
    }
    if (newVC1.length < 8)
    {
      toastr.error("Verify Code must be longer than 8 characters");
      return;
    }

    /* Thank you Stack Overflow for this! */
    var hasAlpha = (/[A-Za-z]+/).test(newVC1),
        hasNumber = (/[0-9]+/).test(newVC1),
        specials = (/[^A-Za-z0-9]+/).test(newVC1);
    if (hasAlpha && hasNumber && specials) {
      this.doCVC(oldVC, newVC1, newVC2);
    }
    else {
      /* Message taken from XUSRB */
      toastr.error("Enter 8-20 characters any combination of alphanumeric-punctuation");
      return;
    }
  });

  // Cancel Change -- just log-out.
  $('#cvcCancelBtn').one('click', function(event){
    $('#modal-window').modal('hide');
    this.logout();
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
module.exports.doCVC = function(oldVC, newVC1, newVC2) {
    var messageObj = {
      service: 'ewd-vista-login',
      type: 'cvc',
      params: {
        oldVC: oldVC,
        newVC1: newVC1,
        newVC2: newVC2
      }
    };

    EWD.send(messageObj, this.CVCPost);
};

/* Verify code Change message from cvc call. Just say if we succceeded, 
 * or log-out if we failed (we don't have any other choice b/c of the 
 * dirty logic in XUSRB). */
module.exports.CVCPost = function(responseObj) {
  // Below line is necessary because click sometimes fires twice (don't exactly know why)
  if (responseObj.message.ok)
  {
    toastr.success("Verify Code changed");
  }
  else
  {
    $('#modal-window').one('hidden.bs.modal', function() {
      this.logout();
    });
    toastr.error(responseObj.message.error);
  }
  
  $('#modal-window').modal('hide');
}

// Modal pane to select division when loggin in.
// XUS DIVISION GET will set the division if there are zero or one divisions
// available for the user. We don't need to call XUS DIVISION SET to set the
// division. If there is more than one, supply user's choice to XUS DIVISON SET.
module.exports.selectDivision = function() {
  // Unbind keydown and modal button event handlers
  $(document).off('keydown');
  $('#modal-window button').off();
  
  var messageObj = {
    service: 'ewd-vista-login',
    type: 'RPC',
    params: {
      rpcName: 'XUS DIVISION GET'
    }
  };
   
  EWD.send(messageObj, function(responseObj) {
    responseObj.message.value.splice(0,1); // Remove array length element
    
    var divisions = [];
    responseObj.message.value.forEach(function(element, index, array) {
       element = element.split('^');
       
       var division     = {};
       division.ien     = element[0];
       division.name    = element[1];
       division.code    = element[2];
       division.default = ((element[3] == 1) ? true : false)
       
       divisions.push(division);
    });
    
    // We are done with selecting division if selectable list is 0. Move to next task. 
    if (divisions.length == 0) {
      this.setContext();
    }
    // Ask a user to select a division.
    else if (divisions.length > 0) {
      var params = {
        service: 'ewd-vista-login',
        name: 'division.html',
        targetId: 'modal-window',
      };
      
      EWD.getFragment(params, function() {
        // Build division list; and mark default and enable OK if VISTA has a default assigned.
        var optionsHtml = '';
        divisions.forEach(function(element, index, array) {
          optionsHtml = optionsHtml + '<option value="' + element.ien + '"';
          if (element.default) {
             optionsHtml = optionsHtml + ' selected';
             $('#ok-button').removeAttr('disabled'); // Enable OK button
          }
          optionsHtml = optionsHtml   + '>' + element.name + '  (' + element.code + ')' + '</option>';
        });
        
        $("#division").append(optionsHtml); // Populate select with options
        $("#division").change(event, function() { // if user selects an item, enable Ok button regardless
          $('#ok-button').removeAttr('disabled');
        }); 
        
        // Set up buttons
        $("#ok-button").one('click', function(e) {
          var ien = $("#division").val();
          $('#modal-window').modal('hide');
          this.setDivision(ien);
        });
        $('#cancel-button').one('click', function(e) {
          this.logout();
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
        
        // Show divisions modal
        $("#modal-window .btn").show();
        $('#modal-window').modal('show');          
      });
    }
  }); // EWD.send
} // VISTA.selectDivision

// Sets division if necessary. Called from selectDivision
module.exports.setDivision = function(ien) {
  var messageObj = {
    service: 'ewd-vista-login',
    type: 'RPC',
    params: {
      rpcName: 'XUS DIVISION SET',
      rpcArgs: [{
        type: 'LITERAL',
        value: '`' + ien
      }]
    }
  }

  // If setting the division fails, close the application
  EWD.send(messageObj, function(responseObj){
    if (responseObj.message.value != 1) {
      toastr.error("Failed to set division");
      this.logout();
    }
    
    this.setContext();
  });
};

/* Create Context Call -- Right now, hardcoded to OR CPRS GUI CHART */
/* I will be getting rid of this as I want to get rid of setting 
 * context on the client side. I want it dealt with transparently on the
 * server side. */
module.exports.setContext = function(responseObj) {
  $('#modal-window').modal('hide');
  
  var messageObj = {
    service: 'ewd-vista-login',
    type: 'RPC',
    params: {
      rpcName: 'XWB CREATE CONTEXT',
      rpcArgs: [{
        type: 'LITERAL',
        value: 'OR CPRS GUI CHART'
      }]
    }
  }

  // If we can't set the context, close the application
  EWD.send(messageObj, function(responseObj){
    if (responseObj.message.value != 1) {
        toastr.error(responseObj.message.value);
        logout();
    }
    else { 
        this.showNav(); 
    }
  });  
};

/* Log out functionality */
logout = function() {
  toastr.info("Logging Out!");
  
  params ={
    service: 'ewd-vista-login',
    type: 'logout'
  }
  EWD.send(params, function() {
    EWD.disconnectSocket();
  });
};

/* ---------------- */
/* THIS IS THE FIRST NON-LOGIN RELATED FUNCTION */

/* Shows navbar and associates the logout button */
module.exports.showNav = function () {
  $('#symbols-button').one('click', this.showSymbolTable);
  $('#logout-button').one('click', this.logout);
  this.showUserInfo();
  $('nav').show();
}

// Get symbol table from server (Button on Navbar)
module.exports.showSymbolTable = function() {
  console.log("Success");
  // Unbind keydown and modal button event handlers
  $(document).off('keydown');
  $('#modal-window button').off();
  
  // Load into message last so user's aren't required to wait for it
  var messageObj = {
    service: 'ewd-vista-login',
    type: 'RPC',
    params: { rpcName: 'ORWUX SYMTAB' }
  };
  
  EWD.send(messageObj, function(responseObj) {
    var symbolTable = responseObj.message.value;
    
    // Fix structure of symbol table object
    var jsonSymbolTable = {};
    var keys = Object.keys(symbolTable);
    for (var i=0; i<keys.length; i=i+2) {
      jsonSymbolTable[symbolTable[keys[i]]] = symbolTable[keys[i + 1]];
    }
    // Convert object to text
    var symbolTableHtml = JSON.stringify(jsonSymbolTable, null, 1);
    // Remove outer braces and whitespace
    symbolTableHtml = symbolTableHtml.slice(2,-1);
    /*
    Fix format based on what Mumps programmers will expect to see and hope for
    the absence of inconvenient patterns in variable values
    */
    symbolTableHtml = symbolTableHtml.replace(/^\s"/,'');
    symbolTableHtml = symbolTableHtml.replace(/.\n\s"/g,'\n\n');
    symbolTableHtml = symbolTableHtml.replace(/": /g, '=');
    symbolTableHtml = symbolTableHtml.replace(/\\"/g, '""');
    
    var params = {
      service: 'ewd-vista-login',
      name: 'symbol-table.html',
      targetId: 'modal-window',
    };

    EWD.getFragment(params, function() {
      // Render symbol table
      $('#symbol-table').append(symbolTableHtml);

      $('#modal-window').on('hidden.bs.modal', function() {
        $('#symbols-button').one('click', this.showSymbolTable);
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

      // Show modal
      $("#modal-window .btn").show();
      $('#modal-window').modal('show');
    });
  });
}

// Get user info
module.exports.showUserInfo = function() {
  var messageObj = {
    service: 'ewd-vista-login',
    type: 'RPC',
    params: {
      rpcName: 'XUS GET USER INFO'
    }
  };
  
  EWD.send(messageObj, function(responseObj) {
    var info = responseObj.message.value;
    
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
    
    // Use DTIME to set session timeout
    this.setTimeout(info[7]);
  });
};

module.exports.setTimeout = function(sessionTimeout) {
  var messageObj = {
    service: 'ewd-vista-login',
    type: "setTimeout",
    params: {
      timeout: sessionTimeout
    }
  }
  EWD.send(messageObj, function(responseObj) {
    // 
  });
}







