/* Note: This code is a skeleton Unit Test runner to try your ideas in
 * first. It will perform the entire VISTA log-in cycle in the correct
 * order */

/* Written by Sam Habiel and Alexis Carlson */
/* License: Apache 2 */

// Unit testing requirements
const assert = require('assert');

// App requirements
const DocumentStore = require('../../qewd/node_modules/ewd-qoper8-cache/node_modules/ewd-document-store');
//const thisInterface = require('nodem'); GT.M
const thisInterface = require('cache');
const runRPC = require('../../ewd-vista/lib/runRPC');
const sessions = require('../../qewd/node_modules/ewd-session/');

let instance = {};
let session = '';

// Unit tests
describe('Login', function() {
  before(function() {
    // Set up database connection
    // GTM:
    /*
    instance.db = new thisInterface.Gtm();
    instance.db.open();
    */
    instance.db = new thisInterface.Cache();
    instance.db.open({path: '/usr/cachesys/mgr/', namespace: 'PANORAMA'});

    instance.documentStore = new DocumentStore(instance.db);
    console.log(instance.documentStore.db.version());

    // Initialize session management
    sessions.addTo(instance.documentStore);
    session = sessions.create('testApp');
    console.log('Session ID : ' + session.id);
    console.log('Session token : ' + session.token);

    // Initialize symbol table management in session
    instance.db.symbolTable = sessions.symbolTable(instance.db);
  });

  describe('setup', function() {
    it('should return some data about the VistA instance', function(){
      let response = runRPC.call(instance, {rpcName: 'XUS SIGNON SETUP'}, session);

      assert.ok(!!response.type);
    });
  });

  describe('credentials', function() {
    it('should not return an error', function(){
      let accessCode = process.argv[3];
      let verifyCode = process.argv[4];

      let params = {
        rpcName: 'XUS AV CODE',
        rpcArgs: [{
          type: 'LITERAL',
          value: accessCode + ';' + verifyCode
        }]
      };
      let response = runRPC.call(instance, params, session);

      assert.ok(!response.value[3], response.value[3]);
    });
  });

  describe('setDivision', function(){
    it('should return a Mumps true', function(){
      let result = true;

      let divisions = runRPC.call(instance, {rpcName: 'XUS DIVISION GET'}, session).value;
      divisions.splice(0,1); // Remove array length element
      divisions.forEach(function(element, index, array) { // Keep only IENs
        array[index] = element.split('^')[0];
      });

      if (divisions.length > 1) {
        params = {
          rpcName: 'XUS DIVISION SET',
          rpcArgs: [{
            type: 'LITERAL',
            value: '`' + divisions[0]
          }]
        };

        result = (runRPC.call(instance, params, session).value == 1) ? true : false;
      }

      assert.ok(result);
    });
  });

  describe('setContext', function(){
    it('should return a Mumps true', function(){
      let params = {
        rpcName: 'XWB CREATE CONTEXT',
        rpcArgs: [{
          type: 'LITERAL',
          value: 'OR CPRS GUI CHART'
        }]
      };
      let result = runRPC.call(instance, params, session).value;

      assert.ok(result);
    });
  });

  describe('getUserInfo', function(){
    it('should return user data', function(){
      let data = runRPC.call(instance, {rpcName: 'XUS GET USER INFO'}, session).value;

      // data[0] is DUZ or 0 if login failed
      assert.ok(!!data[0], 'No user data was returned');
    });
  });

  describe('getSymbolTable', function(){
    it('should return the Mumps symbol table', function(){
      let response = runRPC.call(instance, {rpcName: 'ORWUX SYMTAB'}, session);
      let result = response.error ? false : true;

      assert.ok(result, response.error);
    });
  });

  after(function(){
    instance.db.close();
  });
});
