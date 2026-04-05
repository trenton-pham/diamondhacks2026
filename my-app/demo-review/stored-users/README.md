# Stored User Review Fixtures

These files are the proposed persisted user records for the demo dataset.

They mirror the shape we would actually store for each user in the backend:
- `id`
- `name`
- `bio`
- `privacy`
- `questionnaire`
- `uploadedSources`
- `topicFiles`

Notes:
- `privacy` and `questionnaire` represent data a real user could explicitly input in the app.
- `topicFiles` represent stored inferred context generated from raw uploaded texts.
- These fixtures are for review only and are not yet wired into the live seed store.
