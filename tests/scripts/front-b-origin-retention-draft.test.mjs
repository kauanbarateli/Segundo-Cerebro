// Runs the guarded retention review models in the ordinary script suite.
// These are static/in-memory tests and never connect to a database.
import "../../scripts/verification/front-b-origin-retention-draft/static-review.test.mjs";
import "../../scripts/verification/front-b-origin-retention-draft/coordination-model.test.mjs";
