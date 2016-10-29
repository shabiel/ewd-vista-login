// Client-side tests
describe('ewd-vista-login', function() {
  before(function() {
    // 
  });
  
  beforeEach(function(){
    // Immediately clear any lingering Toastr messages
    toastr.remove();
  })
  
  describe('login', function() {
    it('should log into VistA', function(done) {
      $('#modal-window').one('shown.bs.modal', function() {
        $('#username').val('S9RR3ND3R');
        $('#password').val('NEVR2NEW$%!');
        $('#loginBtn').click();
      
        toastr.options.onShown = function() {
          // Clear Toastr event handler
          toastr.options.onShown = function() {};
          
          if ($('.toast-error').length) {
            let error = new Error($('.toast-message').text());
          
            done(error);
          }
          else if ($('.toast-success').length) {
            done();
          }
        };
      });
    });
  });
  
  if ($('.modal-content.division').length) {
    describe('division', function() {
      it('should set a divsion', function(done) {
        $('ok-button').click();

        toastr.options.onShown = function() {
          // Clear Toastr event handler
          toastr.options.onShown = function() {};
          
          if ($('.toast-error').length) {
            let error = new Error($('.toast-message').text());
          
            done(error);
          }
          else if ($('.toast-success').length) {
            done();
          }
        };
      });
    });
  }
  
  after(function() {
    // $('#modal-window').modal('hide');
  });
});
