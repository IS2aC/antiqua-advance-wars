import tls from 'node:tls';

/**
 * OpenSSL 3.5 (Node 22) propose par défaut un échange de clés hybride post-quantique
 * (X25519MLKEM768) : le premier message TLS dépasse alors un paquet réseau, et le réseau de
 * WSL en perd une bonne moitié (délai de connexion ou ECONNRESET), alors que curl passe.
 * On s'en tient aux courbes classiques, acceptées partout. À importer avant tout `fetch`.
 */
tls.DEFAULT_ECDH_CURVE = 'X25519:prime256v1';
