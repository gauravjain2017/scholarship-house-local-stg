/**
 * csvParser.js
 *
 * This module provides functionality to parse CSV data into JSON format.
 * It uses the 'papaparse' library for parsing CSV strings.
 */
import Papa from 'papaparse';

/**
 * Parses a CSV string into JSON format.
 *
 * @param {string} csvString - The CSV data as a string.
 * @returns {Object[]} - An array of objects representing the parsed CSV data.
 */
const parseCSV = (csvString) => {
  const results = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
  });

  if (results.errors.length) {
    console.error('CSV Parsing Errors:', results.errors);
    throw new Error('Failed to parse CSV data');
  }

  return results.data;
};
/**
 * Parses a CSV, by using parseCSV function, into an array of JSON objects each containing an email, a password, and a role.
 * @param {string} csvString - The CSV data as a string.
 * @returns {Object[]} - An array of objects with email, password, and role fields.
 */
const parseUserCSV = (csvString) => {
  const data = parseCSV(csvString);

  return data.map((row) => ({
    name: row.Name || row.name || '',
    email: row.Email || row.email || '',
    phone: row.Phone || row.phone || '',
    password: row.Password || row.password || '',
    role: row.Role || row.role || 'submitter',

    priority:
      String(row.Priority || row.priority || '')
        .toLowerCase()
        .trim() === 'true',
  }));
};

/**
 * Takes an array of JSON objects that are users and registers them with the server.
 * @param {Object[]} users - An array of JSON objects representing users.
 * @returns {Promise} - A promise that resolves when all users are registered.
 * @throws {Error} - Throws an error if registration fails for any user.
 * @async
 */
const registerUsers = async (users, url) => {
  for (const user of users) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(user),
      });

      if (!response.ok) {
        throw new Error(`Failed to register user ${user.email}`);
      }
    } catch (error) {
      console.error(`Failed to register user ${user.email}:`, error);
      throw new Error(`Failed to register user ${user.email}`);
    }
  }
};

export default { parseCSV, parseUserCSV };
