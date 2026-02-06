# Contributing to Peek

Thank you for your interest in contributing to Peek! This is a personal hobby project, so contributions are welcome but please understand that review and merge times may vary.

## Important Notes

- This is a **hobby project** with no guarantees of support or maintenance
- Pull requests may take a while to review, or may not be reviewed at all
- The project was built through "vibe coding" - quick solutions over perfect code
- Many integrations are untested - contributions to test and fix them are especially welcome

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/unwrntd/peek/issues)
2. If not, create a new issue with:
   - A clear, descriptive title
   - Steps to reproduce the bug
   - Expected vs actual behavior
   - Your environment (OS, browser, Docker version, etc.)
   - Screenshots if applicable

### Suggesting Features

1. Check existing issues for similar suggestions
2. Create a new issue with the "enhancement" label
3. Describe the feature and why it would be useful
4. Be specific about the expected behavior

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test your changes locally
5. Commit with clear, descriptive messages
6. Push to your fork
7. Open a Pull Request

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/peek.git
cd peek

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install

# Start development servers
cd ../backend && npm run dev    # API on :3001
cd ../frontend && npm run dev   # UI on :5173
```

### Code Style

- Use TypeScript for all new code
- Follow existing code patterns and naming conventions
- Keep functions small and focused
- Add comments for complex logic
- Use meaningful variable and function names

### Adding New Integrations

See [docs/ADDING_INTEGRATIONS.md](docs/ADDING_INTEGRATIONS.md) for detailed instructions on adding new service integrations.

## Code of Conduct

Please be respectful and constructive in all interactions. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for details.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
