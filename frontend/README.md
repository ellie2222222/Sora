# Finance Frontend

Next.js + React + TypeScript frontend for the Finance application.

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API URL
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

Frontend will be available at `http://localhost:3000`

## Architecture

- **pages**: Next.js App Router pages
- **components**: Reusable UI components
  - `ui/`: Basic UI components (Button, Input, FormField)
  - `layouts/`: Page layouts (AuthLayout)
- **lib**: Utility functions
  - `api-client.ts`: Axios wrapper with JWT token management
- **schemas**: Zod validation schemas

## Phase 1: Authentication

Implemented pages:
- `/auth/register` - User registration form
- `/auth/login` - User login form
- `/auth/email-verification` - Email verification (via token in URL)
- `/app/dashboard` - Protected dashboard (placeholder)

### Auth Flow

1. **Register**: Fill form → Submit → Email sent → Redirect to login
2. **Verify Email**: Click link in email → Token verified → Can login
3. **Login**: Enter credentials → JWT tokens stored → Redirect to dashboard
4. **Refresh**: Automatic token refresh on 401 response
5. **Logout**: Clear tokens → Redirect to login

### Token Management

- Access tokens stored in localStorage
- Refresh tokens stored in localStorage
- Auto-refresh on 401 response
- Clear tokens on logout

## Component Structure

### UI Components

**Button**: Customizable button with variant/size
```tsx
<Button variant="primary" size="md" loading={isLoading}>
  Click me
</Button>
```

**FormField**: Form field wrapper with label and error
```tsx
<FormField label="Email" id="email" error={errors.email?.message}>
  <Input {...register('email')} />
</FormField>
```

**Input**: Text input with error state
```tsx
<Input type="email" error={!!errors.email} {...register('email')} />
```

## Form Validation

Uses Zod for schema validation + React Hook Form for form state:
- Frontend validation (Zod) for UX feedback
- Backend validation for security
- Consistent with backend DTOs

## Styling

- Tailwind CSS v4
- Global styles in `app/globals.css`
- Component-scoped styles inline

## API Communication

All requests go through `apiClient` which:
- Manages JWT tokens automatically
- Adds Authorization header to requests
- Handles 401 responses (logout + redirect to login)
- Formats requests/responses

Usage:
```tsx
const response = await apiClient.login(email, password)
const user = apiClient.getAccessToken()
apiClient.clearTokens()
```

## Next Phases

- **Phase 2**: Workspace management pages and components
- **Phase 3**: Account and transaction pages
- **Phase 4**: Category management
- **Phase 5**: Bill reminders
- **Phase 6**: Dashboard and analytics
- **Phase 7**: Audit log viewer
