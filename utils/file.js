import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { promises as fsPromises } from 'fs';
import dbClient from './db';
import userUtils from './user';
import basicUtils from './basic';

const fileUtils = {
  async validateBody(request) {
    const {
      name, type, isPublic = false, data,
    } = request.body;

    let { parentId = 0 } = request.body;

    const typesAllowed = ['file', 'image', 'folder'];
    let msg = null;

    if (parentId === '0') parentId = 0;

    if (!name) {
      msg = 'Missing name';
    } else if (!type || !typesAllowed.includes(type)) {
      msg = 'Missing type';
    } else if (!data && type !== 'folder') {
      msg = 'Missing data';
    } else if (parentId && parentId !== '0') {
      let file;

      if (basicUtils.isValidId(parentId)) {
        file = await this.getFile({ _id: ObjectId(parentId) });
      } else {
        file = null;
      }

      if (!file) {
        msg = 'Parent not found';
      } else if (file.type !== 'folder') {
        msg = 'Parent is not a folder';
      }
    }

    const fileParams = {
      name,
      type,
      parentId,
      isPublic,
      data,
    };

    return { error: msg, fileParams };
  },

  async getFile(query) {
    return await dbClient.filesCollection.findOne(query);
  },

  async getFilesOfParentId(query) {
    return await dbClient.filesCollection.aggregate(query).toArray();
  },

  async saveFile(userId, fileParams, FOLDER_PATH) {
    const {
      name, type, isPublic, data,
    } = fileParams;
    let { parentId } = fileParams;

    if (parentId !== 0) parentId = ObjectId(parentId);

    const query = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic,
      parentId,
    };

    if (fileParams.type !== 'folder') {
      const fileNameUUID = uuidv4();
      const fileDataDecoded = Buffer.from(data, 'base64');
      const path = `${FOLDER_PATH}/${fileNameUUID}`;

      query.localPath = path;

      try {
        await fsPromises.mkdir(FOLDER_PATH, { recursive: true });
        await fsPromises.writeFile(path, fileDataDecoded);
      } catch (err) {
        return { error: err.message, code: 400 };
      }
    }

    const result = await dbClient.filesCollection.insertOne(query);

    const newFile = this.processFile(query);

    return { error: null, newFile };
  },

  async updateFile(query, set) {
    return await dbClient.filesCollection.findOneAndUpdate(
      query,
      { $set: set },
      { returnOriginal: false }
    );
  },

  async publishUnpublish(request, setPublish) {
    const { id: fileId } = request.params;

    if (!basicUtils.isValidId(fileId)) {
      return { error: 'Unauthorized', code: 401 };
    }

    const { userId } = await userUtils.getUserIdAndKey(request);

    if (!basicUtils.isValidId(userId)) {
      return { error: 'Unauthorized', code: 401 };
    }

    const user = await userUtils.getUser({ _id: ObjectId(userId) });

    if (!user) {
      return { error: 'Unauthorized', code: 401 };
    }

    const file = await this.getFile({
      _id: ObjectId(fileId),
      userId: ObjectId(userId),
    });

    if (!file) {
      return { error: 'Not found', code: 404 };
    }

    const result = await this.updateFile(
      {
        _id: ObjectId(fileId),
        userId: ObjectId(userId),
      },
      { isPublic: setPublish }
    );

    const updatedFile = this.processFile(result.value);

    return { error: null, code: 200, updatedFile };
  },

  processFile(doc) {
    const file = { id: doc._id, ...doc };

    delete file.localPath;
    delete file._id;

    return file;
  },

  isOwnerAndPublic(file, userId) {
    if ((!file.isPublic && !userId) || (userId && file.userId.toString() !== userId && !file.isPublic)) {
      return false;
    }

    return true;
  },

  async getFileData(file, size) {
    let { localPath } = file;

    if (size) {
      localPath = `${localPath}_${size}`;
    }

    try {
      const data = await fsPromises.readFile(localPath);
      return { data };
    } catch (err) {
      return { error: 'Not found', code: 404 };
    }
  },
};

export default fileUtils;
