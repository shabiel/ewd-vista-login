module.exports = {
'Page title is correct': function (test) {
  test
    .open('http://localhost:8080/ewd-vista/index.html')
    .assert.title().is('VistA', 'It has title')
    .done();
}
};
