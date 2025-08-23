# Overview

RePlate Campus is a comprehensive web application designed to reduce food waste on university campuses by connecting students with discounted surplus food items from campus canteens. The platform features a dual-user system with separate portals for students to browse and claim meals, and staff to list surplus food items. The application implements real-time food listings, secure authentication, a comprehensive claim code system for meal pickup verification, and a food donation management system for NGO partners to handle expired food items.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The client-side application is built using React 18 with TypeScript and follows modern React patterns:

- **Component Architecture**: Utilizes shadcn/ui components built on Radix UI primitives for consistent, accessible UI elements with comprehensive component library including forms, dialogs, tables, and navigation
- **Styling System**: Implements Tailwind CSS with CSS variables for theming, custom animations, and responsive design with dark/light theme support
- **State Management**: Uses React Query (@tanstack/react-query) for server state management with caching and React hooks for local state management
- **Routing**: Implements wouter for lightweight client-side routing with role-based access control separating student and staff dashboards
- **Form Handling**: Integrates react-hook-form with Zod validation for type-safe form management and schema validation

## Backend Architecture

The server follows an Express.js-based REST API pattern with TypeScript:

- **API Layer**: RESTful endpoints organized with middleware for authentication, error handling, and request validation
- **Database Layer**: Uses Drizzle ORM with PostgreSQL for type-safe database operations, schema management, and automatic TypeScript inference
- **Storage Pattern**: Implements a storage interface pattern for data access, providing abstraction over database operations with comprehensive CRUD operations
- **Authentication System**: Custom session-based authentication with demo login capabilities and role-based access control
- **Session Management**: In-memory session store with cookie-based session handling for development

## Data Storage Solutions

- **Primary Database**: PostgreSQL with Neon serverless hosting configured through Drizzle kit for scalable data storage
- **ORM**: Drizzle ORM providing type-safe database queries, migrations, and automatic TypeScript schema inference
- **Schema Design**: Comprehensive schema including users, food items, food claims, food donations with proper relationships and constraints
- **Migration System**: Automated database migrations with Drizzle kit for schema changes and version control

## Authentication and Authorization

- **Session-Based Auth**: Custom session middleware with cookie management for persistent user sessions
- **Role-Based Access**: Differentiated access control for student and staff roles with separate dashboard interfaces
- **Demo Authentication**: Development-friendly demo login system for testing different user roles
- **Security**: Secure session handling with proper cookie configuration and session expiration

# External Dependencies

## Core Technologies
- **Database**: Neon PostgreSQL serverless database with connection pooling
- **ORM**: Drizzle ORM for type-safe database operations and schema management
- **UI Components**: Radix UI primitives for accessible component foundations
- **Styling**: Tailwind CSS for utility-first styling with PostCSS processing
- **Build Tools**: Vite for fast development and build processes with TypeScript support

## Key Libraries
- **Frontend**: React 18, React Query for state management, React Hook Form for form handling
- **Backend**: Express.js, WebSocket support for real-time features
- **Validation**: Zod for runtime type checking and schema validation
- **Development**: ESBuild for production builds, TSX for development server
- **Date Handling**: date-fns for date manipulation and formatting

## Development Tools
- **Replit Integration**: Replit-specific plugins for development environment integration
- **Error Handling**: Runtime error overlay for development debugging
- **Code Analysis**: Cartographer plugin for code visualization and analysis