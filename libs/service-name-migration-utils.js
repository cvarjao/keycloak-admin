'use strict';

const { IDP_REF, CLIENT_MIGRATION_FIELDS } = require('../constants');

/**
 * Replace target string in json object and return the new object
 * @param {Object} jsonContent the content to be updated
 * @param {String} targetString target string to look for to be replaced
 * @param {String} replacement new string
 * @param {Boolean} matchRequired only replace if content is matching targetString
 */
const urlReplacer = (jsonContent, targetString, replacement) => {
  const replacer = new RegExp(targetString, 'g');
  const stringifiedContent = JSON.stringify(jsonContent);
  if (!stringifiedContent.includes(targetString)) console.warn(`----No target string found from - ${jsonContent}`);
  return JSON.parse(stringifiedContent.replace(replacer, replacement));
}


/**
 * Update APP realm IDP configuration
 * @param {String} appRealmName the APP realm's name
 * @param {String} idp the IDP name
 * @param {kcAdmin} kcAdminClient with auth setup
 * @param {String} newRoute new sso host name
 * @param {String} oldRoute current sso host name
 */
const updateAppRealmIdp = async (appRealmName, idp, kcAdminClient, newRoute, oldRoute) => {  
  try {    
    // github example:
    const targetRealm = appRealmName;
    const targetIdp = IDP_REF[idp];

    // Find IDP based on realm name and IDP alias:
    const idpRef = {
      alias: targetIdp.ALIAS,
      realm: targetRealm,
    };

    // 1. get the current idp json content:
    const idpConfig = await kcAdminClient.identityProviders.findOne(idpRef);

    // 2. replace the uri:
    const newIdp = urlReplacer(idpConfig, oldRoute, newRoute);

    // 3. update the idp:
    await kcAdminClient.identityProviders.update(idpRef, newIdp);

  } catch (e) {
    throw e;
  }
}

/**
 * Update IDP realm clients
 * @param {String} appRealmName the APP realm's name
 * @param {String} idp the IDP name
 * @param {kcAdmin} kcAdminClient with auth setup
 * @param {String} newRoute new sso host name
 * @param {String} oldRoute current sso host name
 */
const updateIdpAppClient = async (clientId, idp, kcAdminClient, newRoute, oldRoute) => {  
  try {
    // Set target IDP alias name:
    const targetIdp = IDP_REF[idp.toUpperCase()];

    // client ID format: https://${SSO_ROUTE}/auth/realms/${APP_REALM}
    let idpClientRef = {
      clientId,
      realm: targetIdp.REALM,
    };

    // 1. get the IDP client:
    const idpClients = await kcAdminClient.clients.findOne(idpClientRef);
    if (idpClients.length !== 1) throw Error(`----Not expected clients found #${idpClients.length}!`);
    const idpClient = idpClients[0];

    // 2. replace the uris:
    const newIdpClient = Object.keys(idpClient).reduce((acc, key) => {
      if (CLIENT_MIGRATION_FIELDS.includes(key)) {
        let value = idpClient[key];
        if (key === 'redirectUris') {
          if (value.length === 0) throw Error(`----No redirect uri found!`);
          if (value.length !== 1) console.log(`----Multiple redirect uris found: ${value}`);

          // 2.2 keep both new and old redirect URIs so that team could migrate without breaking it:
          const newIdpClientId = urlReplacer(clientId, oldRoute, newRoute);
          const newRedirectUri = `${newIdpClientId}/broker/${targetIdp.ALIAS}/endpoint*`;
          if (!value.includes(newRedirectUri)) value.push(newRedirectUri);
        } else if (key === 'id') {
          idpClientRef[key] = value;
        } else {
          value = urlReplacer(value, oldRoute, newRoute);
        }
        acc[key] = value;
      }
      return acc;
    }, {});

    // 3. update the idp client:
    await kcAdminClient.clients.update(idpClientRef, newIdpClient);

    // 4. TODO - after confirming changes are good, delete the extra redirect uri from step 2.2

  } catch (e) {
    throw e;
  }
}

module.exports = { urlReplacer, updateIdpAppClient, updateAppRealmIdp };
