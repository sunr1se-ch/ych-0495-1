FROM denoland/deno:1.40.0

WORKDIR /app

COPY . .

RUN deno cache --import-map=import_map.json main.ts && \
    deno run --allow-net --allow-read --allow-write --allow-env --allow-run --import-map=import_map.json dev.ts build

EXPOSE 8000

CMD ["run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "--import-map=import_map.json", "main.ts"]
