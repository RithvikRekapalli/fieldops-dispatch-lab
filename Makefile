.PHONY: docker-up docker-down docker-build docker-test test frontend-build status

docker-up:
	docker compose up --build

docker-down:
	docker compose down

docker-build:
	docker compose build

docker-test:
	docker compose run --rm backend python -m unittest discover tests

test:
	PYTHONPATH=backend python3 -m unittest discover backend/tests

frontend-build:
	cd frontend && npm run build

status:
	docker compose ps

