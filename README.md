# myRecipesApp


NGINX Server
Used for proxying the web applications on the raspberrypi.  Currently proxying for the ‘gwfamilytree’ and ‘myrecipes’ sites, including the site’s APIs.  Nginx is setup as a daemon, so it can be started/stopped with systemctl.

Config Locations:
/etc/nginx/sites-enabled
/etc/nginx/sites-available

Starting/Stopping nginx:
systemctl stop nginx.service
systemctl start nginx.service

Default listener port: 80
Gwfamilytree API proxy port: 4001
Myrecipes API proxy port 4002
