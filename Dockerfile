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

# Sin esto, para Docker el contenedor está sano mientras nginx no muera. Pero
# nginx vivo no significa carta servida: si el COPY de arriba se hubiera hecho
# sobre una carpeta vacía, o un volumen tapara la raíz web, el proceso seguiría
# aceptando conexiones y devolvería 404 a todo el mundo. Desde fuera eso se ve
# como una carta en blanco, y nadie se entera hasta que llama un restaurante.
#
# Por eso pide el index.html de verdad y no solo el puerto: lo que se comprueba
# es que hay algo que servir, no que el proceso respira.
#
# No pasa por el panel a propósito. El bloque 'location /' de nginx.conf manda
# a los robots a /api/og del panel, pero esta petición no lleva ese User-Agent,
# así que se resuelve con el archivo local. Si preguntara por algo que cruza al
# panel, un panel caído marcaría enfermas las cartas — que siguen sirviéndose
# perfectamente sin él.
#
# wget viene con busybox en la imagen alpine, así que no hace falta curl.
# 5 s de gracia bastan: nginx no tiene colas que levantar, arranca y ya está.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/index.html > /dev/null || exit 1
