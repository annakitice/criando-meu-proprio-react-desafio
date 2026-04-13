Missão 5 — Didact + JSX (Babel) + contador

Como rodar (obrigatório HTTP — Babel não funciona com file://):
  cd mission-5
  python3 -m http.server 8080

No navegador: http://localhost:8080

Arquivos:
  didact.js  — API pública completa (createElement, render, useState)
  index.html — Babel standalone + didact.js + app.js (type="text/babel")
  app.js     — /** @jsx Didact.createElement */ + componente Counter
