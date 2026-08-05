# Film Review API

A minimal FastAPI-based backend for movie reviews and watchlists.

## Overview

- Routes organized under `routers/` for `auth`, `movies`, `reviews`, `social`, and `watchlist`.
- Database connection pool managed in `database.py` (MySQL).
- Uses query-seeded randomized pagination for the homepage.

## Quickstart

1. Create a Python virtual environment and activate it:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install dependencies:

```powershell
pip install -r requirements.txt
```

3. Create a `.env` file at the project root with the following variables:

```
DB_HOST=your_db_host
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
```

4. Run the app (development):

```powershell
uvicorn main:app --reload
```

## Endpoints

See the `/docs` for endpoint implementations. 

## Security

- Do not commit `.env` or any credentials. This repository includes a `.gitignore` entry for `.env`.
- If you accidentally committed secrets, remove them from git history before pushing to a public repo.

## License

This project is provided under the MIT License. See `LICENSE` for details.

## Author

- mahathirmoon
