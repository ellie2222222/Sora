-- Create workspaces table
CREATE TABLE workspaces (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE INDEX idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX idx_workspaces_created_at ON workspaces(created_at);
CREATE INDEX idx_workspaces_deleted_at ON workspaces(deleted_at);

-- Create workspace_members table
CREATE TABLE workspace_members (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role VARCHAR(20) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);

-- Create workspace_invitations table
CREATE TABLE workspace_invitations (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    created_by INTEGER NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_workspace_invitations_workspace_id ON workspace_invitations(workspace_id);
CREATE INDEX idx_workspace_invitations_email ON workspace_invitations(email);
CREATE INDEX idx_workspace_invitations_token ON workspace_invitations(token);
CREATE INDEX idx_workspace_invitations_expires_at ON workspace_invitations(expires_at);

-- Create categories table (default categories per workspace)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL,
    color VARCHAR(7),
    icon VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
    UNIQUE(workspace_id, name)
);

CREATE INDEX idx_categories_workspace_id ON categories(workspace_id);
CREATE INDEX idx_categories_type ON categories(type);
CREATE INDEX idx_categories_deleted_at ON categories(deleted_at);
