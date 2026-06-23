const { User } = require('../models/User');

const userExists = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.json({ exists: false });
    }

    const user = await User.findByEmail(email);
    return res.json({ exists: !!user });
  } catch (err) {
    console.error('userExists error:', err);
    return res.status(500).json({ exists: false });
  }
};

module.exports = { userExists };
