// Client-side tests
describe('ewd-vista-login', function() {
  before(function() {
    // 
  });
  
  describe('login', function() {
    it('should log into VistA', function(done) {
      $('#modal-window').one('shown.bs.modal', function() {
        $('#username').val('S9RR3ND3R');
        $('#password').val('NEVR2NEW$%!');
        $('#loginBtn').click();
      
        $('#modal-window').one('shown.bs.modal', function() {
          // Clear Toastr event handler for fail case
          toastr.options.onShown = function() {};
          
          done();
        });
        
        toastr.options.onShown = function() {
          // Clear jQuery event handler for success case
          $('#modal-window').off('shown.bs.modal');
          
          let error = new Error($('.toast-message').text());
          
          // Clear Toastr event handler for fail case
          toastr.options.onShown = function() {};
          
          done(error);
        };
      });
    });
  });
  
  // if ($('.modal-content.division').length) {
  //   describe('division', function() {
  //     it('should set a divsion', function(done) {
  //       $('ok-button').click();
  //
  //       done();
  //     });
  //   });
  // }
  
  after(function() {
    $('#modal-window').hide();
  });
});
