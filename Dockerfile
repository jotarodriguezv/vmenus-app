FROM nginx:alpine

COPY . /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# nginx.conf viaja en el contexto porque el COPY de arriba lo necesita, así
# que el primer COPY también lo deja caer en la raíz web — y esa carpeta se
# sirve tal cual: quedaba público en https://<carta>/nginx.conf.
#
# No se puede resolver desde .dockerignore: excluirlo de ahí lo saca del
# contexto entero y el COPY a conf.d/ falla. El sitio correcto para quitarlo
# es aquí, una vez ya está donde hace falta.
#
# Hoy no enseña ningún secreto —el host del panel ya está en
# core/analytics.js, que es JavaScript público— pero lo que se añada mañana a
# ese archivo se serviría igual sin que nadie lo note.
RUN rm -f /usr/share/nginx/html/nginx.conf

EXPOSE 80
