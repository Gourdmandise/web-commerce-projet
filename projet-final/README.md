# web-commerce-projet
Site e-commerce développé dans le cadre d'un stage informatique

## Docker

Le projet est maintenant dockerisé avec deux services:

- `frontend` pour l'application Angular
- `backend` pour l'API Express

### Démarrage

Depuis le dossier `projet-final`:

```bash
docker compose up --build
```

Le front sera disponible sur `http://localhost:4200` et le backend sur `http://localhost:3001`.

Le backend lit ses variables depuis `x3com-backend/.env`.
