import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export default class AuthController {
  /**
   * Endpoint: /signin
   * Method: GET
   * Description: Authenticate user and generate a new authentication token.
   * Response:
   *   - Status Code: 200
   *   - Body: { "token": "generated-token" }
   *   - Status Code: 401
   *   - Body: { "error": "Unauthorized" }
   */
  static getConnect = async (request, response) => {
    try {
      const Authorization = request.header('Authorization') || '';
      const credentials = Authorization.split(' ')[1];
      if (!credentials) return response.status(401).send({ error: 'Unauthorized' });

      const decodedCredentials = Buffer.from(credentials, 'base64').toString('utf-8');
      const [email, password] = decodedCredentials.split(':');
      if (!email || !password) return response.status(401).send({ error: 'Unauthorized' });

      const sha1Password = sha1(password);

      // Find the user associated with the email and hashed password
      const finishedCreds = { email, password: sha1Password };
      const user = await dbClient.users.findOne(finishedCreds);

      if (!user) return response.status(401).send({ error: 'Unauthorized' });

      // Generate a random token using uuidv4
      const token = uuidv4();
      const key = `auth_${token}`;
      const hoursForExpiration = 24;

      // Store user ID in Redis with token as key, set to expire in 24 hours
      await redisClient.set(key, user._id.toString(), hoursForExpiration * 3600);

      return response.status(200).send({ token });
    } catch (error) {
      console.error('Error during sign-in:', error);
      return response.status(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Endpoint: /signout
   * Method: GET
   * Description: Sign out the user based on the provided token.
   * Response:
   *   - Status Code: 204
   *   - Status Code: 401
   *   - Body: { "error": "Unauthorized" }
   */
  static getDisconnect = async (request, response) => {
    try {
      const token = request.headers['x-token'];
      if (!token) return response.status(401).send({ error: 'Unauthorized' });

      const user = await redisClient.get(`auth_${token}`);
      if (!user) return response.status(401).send({ error: 'Unauthorized' });

      // Delete the token from Redis
      await redisClient.del(`auth_${token}`);

      return response.status(204).end();
    } catch (error) {
      console.error('Error during sign-out:', error);
      return response.status(500).send({ error: 'Internal Server Error' });
    }
  };
}
