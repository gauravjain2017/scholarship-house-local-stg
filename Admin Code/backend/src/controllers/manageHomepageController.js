const ManageHomepage = require('../models/ManageHomepage');

/**
 * Save or update a homepage layout.
 * If a record with the given type already exists, update it; otherwise create new.
 */
const saveHomepage = async (req, res) => {
  try {
    const { type, payload, global_css } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'type is required' });
    }
    if (!payload) {
      return res.status(400).json({ error: 'payload is required' });
    }

    // Check if a record with this type already exists
    const existing = await ManageHomepage.getByType(type);

    if (existing) {
      const updated = await ManageHomepage.update(existing.id, {
        payload,
        global_css: global_css ?? '',
      });
      return res.json({ message: 'Homepage updated successfully', data: updated });
    }

    // Create new record
    const created = await ManageHomepage.create({
      type,
      payload,
      global_css: global_css ?? '',
    });
    return res.status(201).json({ message: 'Homepage created successfully', data: created });
  } catch (error) {
    console.error('Error saving homepage:', error);
    return res.status(500).json({ error: 'Failed to save homepage' });
  }
};

/**
 * Get a homepage layout by type
 */
const getHomepage = async (req, res) => {
  try {
    const { type } = req.params;
    

    if (!type) {
      return res.status(400).json({ error: 'type is required' });
    }

    const homepage = await ManageHomepage.getByType(type);

    if (!homepage) {
      return res.status(404).json({ error: 'Homepage not found' });
    }

    return res.json({ data: homepage });
  } catch (error) {
    console.error('Error getting homepage:', error);
    return res.status(500).json({ error: 'Failed to get homepage' });
  }
};

module.exports = {
  saveHomepage,
  getHomepage,
};
