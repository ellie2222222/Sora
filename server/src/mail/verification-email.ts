import type { Locale } from '@sora/contracts';

import type { OutgoingMail } from './mail.service.ts';

interface Copy {
  subject: string;
  body: (code: string, minutes: number) => string;
}

/** Written in the account's chosen language, `users.locale`, as the app itself is. */
const COPY: Record<Locale, Copy> = {
  en: {
    subject: 'Your Sora verification code',
    body: (code, minutes) => `Your code is ${code}. Enter it in Sora within ${minutes} minutes to verify this email.\n\nIf you didn't ask for it, ignore this message.`,
  },
  vi: {
    subject: 'Mã xác minh Sora của bạn',
    body: (code, minutes) => `Mã của bạn là ${code}. Nhập mã trong Sora trong vòng ${minutes} phút để xác minh email này.\n\nNếu bạn không yêu cầu mã này, hãy bỏ qua thư.`,
  },
  de: {
    subject: 'Dein Sora-Bestätigungscode',
    body: (code, minutes) => `Dein Code lautet ${code}. Gib ihn innerhalb von ${minutes} Minuten in Sora ein, um diese E-Mail-Adresse zu bestätigen.\n\nWenn du ihn nicht angefordert hast, ignoriere diese Nachricht.`,
  },
  es: {
    subject: 'Tu código de verificación de Sora',
    body: (code, minutes) => `Tu código es ${code}. Introdúcelo en Sora en un plazo de ${minutes} minutos para verificar este correo.\n\nSi no lo pediste, ignora este mensaje.`,
  },
  fr: {
    subject: 'Votre code de vérification Sora',
    body: (code, minutes) => `Votre code est ${code}. Saisissez-le dans Sora dans les ${minutes} minutes pour vérifier cette adresse e-mail.\n\nSi vous ne l’avez pas demandé, ignorez ce message.`,
  },
  hi: {
    subject: 'आपका Sora सत्यापन कोड',
    body: (code, minutes) => `आपका कोड ${code} है। इस ईमेल को सत्यापित करने के लिए इसे ${minutes} मिनट के भीतर Sora में दर्ज करें।\n\nयदि आपने इसका अनुरोध नहीं किया, तो इस संदेश को अनदेखा करें।`,
  },
  ja: {
    subject: 'Sora の確認コード',
    body: (code, minutes) => `確認コードは ${code} です。${minutes} 分以内に Sora で入力して、このメールアドレスを確認してください。\n\n心当たりがない場合は、このメールを無視してください。`,
  },
  ko: {
    subject: 'Sora 인증 코드',
    body: (code, minutes) => `인증 코드는 ${code}입니다. ${minutes}분 안에 Sora에 입력해 이 이메일을 인증하세요.\n\n요청하지 않았다면 이 메일을 무시하세요.`,
  },
  ru: {
    subject: 'Ваш код подтверждения Sora',
    body: (code, minutes) => `Ваш код: ${code}. Введите его в Sora в течение ${minutes} мин., чтобы подтвердить этот адрес.\n\nЕсли вы его не запрашивали, просто проигнорируйте это письмо.`,
  },
  zh: {
    subject: '你的 Sora 验证码',
    body: (code, minutes) => `你的验证码是 ${code}。请在 ${minutes} 分钟内在 Sora 中输入以验证此邮箱。\n\n如果不是你本人请求的，请忽略此邮件。`,
  },
};

export function verificationEmail(to: string, locale: Locale, code: string, minutes: number): OutgoingMail {
  const copy = COPY[locale];
  return { to, subject: copy.subject, text: copy.body(code, minutes) };
}
