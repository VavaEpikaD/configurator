'use strict';

// Keep the long-lived backend untouched and compose new feature modules around
// it. Feature-specific compatibility layers are spread last so they can safely
// override one callable without replacing unrelated backend functionality.
module.exports = {
  ...require('./index.js'),
  ...require('./quotation.js'),
  ...require('./profile.js'),
  ...require('./sales-dashboard.js'),
  ...require('./profile-update.js'),
  ...require('./configurator-colors.js'),
};
