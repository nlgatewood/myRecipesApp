# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
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
