# Real Estate Portfolio Project

This is a full-stack real estate web application built as a portfolio project to demonstrate backend API development, frontend admin UI development, authentication, role-based access control, and full-stack data flow.

The project uses FastAPI for the backend, PostgreSQL for the database, Docker for local services, and Angular with Tailwind CSS for the frontend.

## Project Status

This project is actively in development.

Current focus areas include:

- Backend API structure
- Database-backed listing data
- JWT authentication
- Role-based access control
- Angular admin interface
- Full-stack frontend-to-backend integration

## Tech Stack

### Backend

- Python
- FastAPI
- PostgreSQL
- SQLAlchemy
- Pydantic
- JWT authentication
- pytest
- Docker

### Frontend

- Angular
- TypeScript
- Tailwind CSS
- Angular services
- Angular routing
- Responsive admin UI

## Project Overview

The backend provides a FastAPI API for managing real estate listing data, authentication, and protected routes.

The frontend provides an Angular admin interface with pages for the dashboard, users, and listings.

The listings page connects to the backend API and displays PostgreSQL-backed data in the Angular admin table.

The basic full-stack data flow is:

```text
Angular frontend -> FastAPI backend -> PostgreSQL database -> FastAPI response -> Angular table
```

## Project Walkthrough Videos

I recorded short milestone videos for this project to show the build progress and explain the major backend and frontend pieces.

The playlist includes walkthroughs for FastAPI setup, CRUD API development, PostgreSQL-backed listing data, JWT authentication, role-based access control, Angular admin pages, and full-stack Angular to FastAPI data flow.

[Watch the Real Estate Portfolio Project video playlist](PASTE_YOUTUBE_PLAYLIST_LINK_HERE)
 