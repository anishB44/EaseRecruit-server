import { ENUM_USER_ROLE } from '@/enums/user';
import User from './model';
import { emailSender } from '@/helpers/emailSender';
import ejs from 'ejs';
import path from 'path';
import { IConfirmAccountMail } from './interface';
import config from '@/config';

const getLastUserId = async (role: ENUM_USER_ROLE) => {
  const user = await User.findOne({ role }).sort({ createdAt: -1 });

  return user?.id.substr(3);
};

const generateId = async (role: ENUM_USER_ROLE) => {
  let prefix = 'AD';
  if (role !== ENUM_USER_ROLE.ADMIN)
    prefix = role === ENUM_USER_ROLE.CANDIDATE ? 'CA' : 'CO';

  const lastUserId = (await getLastUserId(role)) || String(0).padStart(5, '0');
  let generatedId = (parseInt(lastUserId) + 1).toString().padStart(5, '0');
  generatedId = `${prefix}-${generatedId}`;

  return generatedId;
};

const validateImageField = (userRole: ENUM_USER_ROLE, filedName: string) => {
  let isValid = true;
  let error = '';

  if (userRole === ENUM_USER_ROLE.CANDIDATE) {
    if (filedName !== 'avatar' && filedName !== 'banner') {
      isValid = false;
      error = 'Field name must be avatar/banner';
    }
  }

  if (userRole === ENUM_USER_ROLE.COMPANY) {
    if (filedName !== 'logo' && filedName !== 'banner') {
      isValid = false;
      error = 'Field name must be logo/banner';
    }
  }

  return { isValid, error };
};

const sendConfirmationEmail = async ({
  email,
  token,
  name,
}: IConfirmAccountMail) => {
  const confirmationURL = `${config.CLIENT_URL}/confirm-account/${name}/${token}`;

  const templatePath = path.join(
    __dirname,
    '../../../views/templates/confirm-email.ejs'
  );
  const emailContent = await ejs.renderFile(templatePath, {
    name,
    confirmationURL,
  });

  const mailInfo = {
    to: email,
    subject: 'Confirm Your Account',
    html: emailContent,
  };

  await emailSender(mailInfo);
};

export const UserUtils = {
  generateId,
  validateImageField,
  sendConfirmationEmail,
};
