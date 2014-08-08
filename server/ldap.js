var assert, ldap, Future, LDAP;

ldap = Meteor.require('ldapjs');
assert = Npm.require('assert');
Future = Npm.require('fibers/future');

LDAP = {};
LDAP.searchOu = 'ou=People,dc=rit,dc=edu';
LDAP.searchQuery = function(user){
  return {
    filter: "(uid=" + user + ")",
    scope: 'sub'
  };
};

LDAP.checkAccount = function(options) {
  var dn, future;
  LDAP.client = ldap.createClient({
    url: process.env.LDAP_URL,
    maxConnections: 2,
    bindDN:          'uid=' + process.env.LDAP_USERNAME + ',ou=People,dc=rit,dc=edu',
    bindCredentials: process.env.LDAP_PASSWORD  
  });
  options = options || {};
  dn = [];
  future = new Future();
  if (options.password.length === 0 || options.username.length === 0) {
    future['return'](void 8);
    return;
  }
  LDAP.client.search(LDAP.searchOu, LDAP.searchQuery(options.username), function(err, search) {
    assert.ifError(err);
    search.on('searchEntry', function(entry) {
      dn.push(entry.objectName);
      return LDAP.displayName = entry.object.displayName;
    });
    search.on('error', function(err){
      throw new Meteor.Error(500, "LDAP server error");
    });
    return search.on('end', function() {
      if (dn.length === 0) {
        future['return'](false);
        return false;
      }
      return LDAP.client.bind(dn[0], options.password, function(err) {
        if (err) {
          future['return'](false);
          return false;
        }
        return LDAP.client.unbind(function(err) {
          assert.ifError(err);
          return future['return'](!err);
        });
      });
    });
  });
  return future.wait();
};

Accounts.registerLoginHandler('ldap', function(loginRequest) {
  var user, userId;
  if (LDAP.checkAccount(loginRequest)) {
    user = Meteor.users.findOne({
      username: loginRequest.username
    });
    if (user) {
      userId = user._id;
    } else {
      userId = Meteor.users.insert({
        username: loginRequest.username,
        profile: {
          name: LDAP.displayName
        }
      });
    }
    return {
      userId: userId
    };
  }
});