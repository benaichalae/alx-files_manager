import { ObjectId } from 'mongodb';

/**
 * Module with basic utilities
 */
const basicUtils = {
  /**
   * Checks if Id is Valid for Mongo
   * @param {string|number} id - ID to be evaluated
   * @returns {boolean} true if valid, false if not
   */
  isValidId(id) {
    if (typeof id === 'string' && ObjectId.isValid(id)) {
      return true;
    }
    return false;
  },
};

export default basicUtils;
