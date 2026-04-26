/**
 * Express middleware factory for Joi schemas.
 */
export function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], { abortEarly: false, stripUnknown: true });
    if (error) {
      const message = error.details.map((d) => d.message).join(', ');
      return res.status(400).json({ message });
    }
    req[property] = value;
    next();
  };
}
