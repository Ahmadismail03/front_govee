# تشغيل التطبيق - إعداد سريع

## 1. تشغيل الباكند
```bash
cd gov-ai-agent
npm run dev
```
الباكند سيعمل على: `http://localhost:4000`

## 2. تشغيل التطبيق

### للـ Android Emulator أو iOS Simulator:
```bash
cd smart-gov-app
npx expo start
```
✅ **لا تحتاج تغيير شيء** - سيشتغل تلقائياً!

### للهاتف الفيزيائي (Physical Device):
1. شغّل أمر `ipconfig` (Windows) أو `ifconfig` (Mac/Linux)
2. انسخ الـ IPv4 Address (مثال: `192.168.1.2`)
3. أنشئ ملف `.env` من النسخة التجريبية:
   ```bash
   cp .env.example .env
   ```
4. عدّل الـ IP في `.env`:
   ```
   EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:4000
   ```
5. شغّل التطبيق:
   ```bash
   npx expo start
   ```

## الاختصارات التلقائية:
- **Android Emulator**: يستخدم `10.0.2.2:4000` تلقائياً
- **iOS Simulator**: يستخدم `localhost:4000` تلقائياً  
- **Physical Device**: يستخدم `.env` أو fallback

---

## Setup Instructions (English)

### For Emulators/Simulators:
No configuration needed! Just run `npx expo start` and it will auto-detect.

### For Physical Devices:
1. Find your computer's IP address:
   - Windows: Run `ipconfig` in CMD
   - Mac/Linux: Run `ifconfig` in Terminal
2. Copy `.env.example` to `.env`
3. Update the IP address in `.env`
4. Run `npx expo start`
