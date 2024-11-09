import { ENUM_USER_ACCOUNT_STATUS, ENUM_USER_ROLE } from '@/enums/user';
import ApiError from '@/errors/ApiError';
import httpStatus from 'http-status';
import Candidate from '../candidate/model';
import Company from '../company/model';
import { IUser } from './interface';
import User from './model';
import { UserUtils } from './utils';
import { IUploadFile } from '@/interfaces/file';
import { FileUploader } from '@/helpers/fileUploader';
import { ENUM_FILE_TYPE } from '@/enums/file';
import { unlinkSync } from 'fs';
import { JwtPayload } from 'jsonwebtoken';

const me = async (id: string) => {
  let user: { [key: string]: unknown } | null = await User.findOne({
    id,
  });

  if (!user)
    throw new ApiError(httpStatus.BAD_REQUEST, "User account doesn't exist");

  user = await User.getRoleSpecificDetails(id);

  if (!user)
    throw new ApiError(httpStatus.BAD_REQUEST, 'User account is inactive');

  return user;
};

const signUp = async (payload: IUser, name: string) => {
  // 1. Is user exist
  const isExist = await User.findOne({
    email: payload.email,
    status: ENUM_USER_ACCOUNT_STATUS.ACTIVE,
  });
  if (isExist)
    throw new ApiError(httpStatus.BAD_REQUEST, 'User account  already exist');

  // 2. Delete inactivated user with same email
  await User.deleteOne({ email: payload.email });

  // 3. Generate userId and hash password
  const id = await UserUtils.generateId(payload.role);
  payload.id = id;

  const user = await User.create(payload);

  if (!user)
    throw new ApiError(httpStatus.BAD_REQUEST, 'Failed to create user account');

  // 4. Send Confirmation Email to User
  const email = user.email;
  const token = user.generateToken();
  await UserUtils.sendConfirmationEmail({ email, token, name });

  // 5. Finally Save user doc
  await user.save();
};

const confirmAccount = async (name: string, token: string) => {
  // 1. Check user existence
  const user = await User.findOne({ confirmationToken: token }).select(
    '+confirmationToken +confirmationTokenExpires'
  );
  if (!user) throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid Token');

  // 2. Check Token Expire Date
  const expired = new Date() > (user.confirmationTokenExpires as Date);
  if (expired) throw new ApiError(httpStatus.BAD_REQUEST, 'User Token Expired!');

  // 3. Create Candidate/Company account
  const userInfo = { id: user.id, name };
  if (user.role === ENUM_USER_ROLE.CANDIDATE) {
    const candidate = await Candidate.create(userInfo);
    if (!candidate)
      throw new ApiError(
        httpStatus.FAILED_DEPENDENCY,
        'Failed to create candidate account'
      );
    user.candidate = candidate._id;
  }

  if (user.role === ENUM_USER_ROLE.COMPANY) {
    const company = await Company.create(userInfo);
    if (!company)
      throw new ApiError(
        httpStatus.FAILED_DEPENDENCY,
        'Failed to create company account'
      );
    user.company = company._id;
  }

  // 4. Update User Info
  user.status = ENUM_USER_ACCOUNT_STATUS.ACTIVE;
  user.confirmationToken = undefined;
  user.confirmationTokenExpires = undefined;

  await user.save();

  return user;
};

const uploadImage = async (
  authUser: JwtPayload,
  filedName: string,
  file: IUploadFile
) => {
  const { userId, role } = authUser;

  if (!file) throw new ApiError(httpStatus.BAD_REQUEST, 'Must upload an Image');

  // 1. Validate image field name
  const { isValid, error } = UserUtils.validateImageField(role, filedName);
  if (!isValid) {
    unlinkSync(file.path);
    throw new ApiError(httpStatus.BAD_REQUEST, error);
  }

  // 2. Check user account
  const user = await User.findOne({ id: userId });
  if (!user) {
    unlinkSync(file.path);
    throw new ApiError(httpStatus.NOT_FOUND, "User account doesn't exist!");
  }

  // 3. Upload Image
  const uploadImage = await FileUploader.uploadToCloudinary(
    file,
    ENUM_FILE_TYPE.IMAGE
  );

  const imageUrl = uploadImage.secure_url;


  // 4. Save image url
  if (user.role === ENUM_USER_ROLE.CANDIDATE)
    await Candidate.findOneAndUpdate({ id: userId }, { [filedName]: imageUrl });
  else
    await Company.findOneAndUpdate({ id: userId }, { [filedName]: imageUrl });

  return { imageUrl };
};

const getImageUrl = async (id: string, fieldName: string) => {
  const user = await User.getRoleSpecificDetails(id);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User account doesn't exist!");
  }

  // @ts-ignore
  const imageUrl = user[fieldName] || null;
  return { imageUrl };
};

export const UserServices = {
  me,
  signUp,
  confirmAccount,
  uploadImage,
  getImageUrl,
};
