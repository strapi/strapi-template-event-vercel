module.exports = function(scope) {
  return {
    package: {
      dependencies: {
        "fs-extra": "^9.0.1",
        "strapi-plugin-graphql": scope.strapiVersion,
      }
    }
  }
}
