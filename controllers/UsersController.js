import sha1 from 'sha1';
import Queue from 'bull';
import { findUserById, findUserIdByToken } from '../utils/helpers';
import dbClient from '../utils/db';

const userQueue = new Queue('userQueue');

export default class UsersController {
  /**
   * Endpoint: POST /users/new
   * Description: Create a new user using email and password.
   * Response:
   *   - Status Code: 201
   *   - Body: { id, email }
   *   - Status Code: 400
   *   - Body: { error: 'Missing email' }
   *      { error: 'Missing password' }
   *      { error: 'Already exist' }
   *   - Status Code: 500
   *   - Body: { error: 'Error creating user' }
   */
  static postNew = async (request, response) => {
    try {
      const { email, password } = request.body;

      // Check for email and password
      if (!email) return response.status(400).send({ error: 'Missing email' });
      if (!password) return response.status(400).send({ error: 'Missing password' });

      // Check if the email already exists in DB
      const emailExists = await dbClient.users.findOne({ email });
      if (emailExists) return response.status(400).send({ error: 'Already exist' });

      // Insert new user
      const sha1Password = sha1(password);
      const result = await dbClient.users.insertOne({ email, password: sha1Password });

      const user = { id: result.insertedId, email };

      // Add job to userQueue
      await userQueue.add({ userId: result.insertedId.toString() });

      return response.status(201).send(user);
    } catch (error) {
      console.error('Error creating user:', error);
      return response.status(500).send({ error: 'Error creating user' });
    }
  };

  /**
   * Endpoint: GET /users/me
   * Description: Retrieve the current user based on the token used.
   * Response:
   *   - Status Code: 200
   *   - Body: { id, email }
   *   - Status Code: 401
   *   - Body: { error: 'Unauthorized' }
   */
  static getMe = async (request, response) => {
    try {
      const token = request.headers['x-token'];
      if (!token) return response.status(401).json({ error: 'Unauthorized' });

      // Retrieve the user ID based on the token
      const userId = await findUserIdByToken(request);
      if (!userId) return response.status(401).json({ error: 'Unauthorized' });

      // Find user by ID
      const user = await findUserById(userId);
      if (!user) return response.status(401).json({ error: 'Unauthorized' });

      // Prepare response
      const { _id, password, ...processedUser } = user; // Remove sensitive information
      processedUser.id = _id; // Rename _id to id

      return response.status(200).json(processedUser);
    } catch (error) {
      console.error('Error retrieving user:', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
