// Ce fichier sert de point d'entrée (proxy) pour les hébergeurs comme Render
// qui pourraient avoir conservé 'node server.js' comme commande de démarrage.
// L'application réelle a été déplacée dans le dossier 'server/'.

require('./server/server.js');
