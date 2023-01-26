module.exports = function custom_auth (req, res, next) {
    // do your custom authentication
    req.user = new cds.User.Privileged;
    next();
  }