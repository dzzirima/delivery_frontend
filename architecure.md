 The pattern for every future feature:
  1. features/<name>/ — smart container: owns state, calls services, coordinates ui/ children
  2. features/<name>/ui/ — dumb presentational components: input() for data in, output() for events out, zero business logic
  3. pages/dashboard/ stays a thin shell that just imports and renders the active feature component
