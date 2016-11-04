// Client-side tests
describe('ewd-vista-login', function() {
  before(function() {
    
  });
  
  beforeEach(function(){
    // Immediately clear any lingering Toastr messages
    toastr.remove();
  });
  
  afterEach(function(){

  });
  
  describe('login', function() {
    it('should log into VistA', function(done) {
      EWD.on('loginStatus', function(responseObj) {
        if (responseObj.message.error) {
          let error = new Error(responseObj.message.error);
          
          done(error);
        }
        else {
          done();
        }
      }, true);
      
      $('#modal-window').one('shown.bs.modal', function() {
        $('#username').val('S9RR3ND3R');
        $('#password').val('NEVR2NEW$%');
        $('#loginBtn').click();
      });
    });
  });
  
  
  describe('setDivision', function() {
    it('should set a division', function(done) {
      EWD.on('setDivisionReady', function() {
        EWD.on('setDivisionStatus', function(responseObj) {
          if (responseObj.message.value != 1) {
            let error = new Error('Failed to set division');
        
            done(error);
          }
          else {
            done();
          }
        }, true);
      
        $('#ok-button').click();
      }, true);
    });
  });
  
  describe('setContext', function() {
    it('should set a context', function(done) {
      EWD.on('setContextStatus', function(responseObj) {
        if (responseObj.message.value != 1) {
          let error = new Error('Failed to set context');
      
          done(error);
        }
        else {
          done();
        }
      }, true);
    });
  });
  
  describe('showUserInfo', function() {
    it('should collect user info', function(done) {
      EWD.on('showUserInfoStatus', function(responseObj) {
        if (typeof(responseObj.message.value) != 'object') {
          let error = new Error('Failed to get user info');
      
          done(error);
        }
        else {
          done();
        }
      }, true);
    });
  });
  
  after(function() {
    // Immediately clear any lingering Toastr messages
    toastr.remove();
    // Make sure screen is clear so test results can be seen
    $('#modal-window').modal('hide');
  });
});
