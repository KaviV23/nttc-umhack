<p align="center">
  <img src="public/grabcastnback.png" alt="Project Logo" width="450" height="650"/>
</p>
<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/frontend-react%20%7C%20mantine-blue?style=for-the-badge" /></a>
  <a href="#"><img src="https://img.shields.io/badge/storage-postgresql%20%7C%20csv-yellow?style=for-the-badge" /></a>
  <a href="#"><img src="https://img.shields.io/badge/infra-docker%20%7C%20nginx-lightgrey?style=for-the-badge" /></a>
</p>
<p align="center">
  Run LLM apps locally using FastAPI and Ollama. Designed for hackathon speed, production stability, and AI-first development.
</p>

# 🏆 Submission for UM Hackathon 2024 🏆

This repository contains our project submission for the University of Malaya Hackathon.

**Key Resources:**

*   🎨 **Prototype:** [Figma Prototype](https://www.figma.com/proto/SRxrtm9e8qbYJe3jPzHSmM/UMHackathon?node-id=21-610&p=f&t=2kfCQp9856B8CqSh-0&scaling=scale-down&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=21%3A610)
*   📄 **Documentation:** [Google Docs](https://docs.google.com/document/d/1mhMB6jfrt9OWpvGafP0qIJ3PaWjJl8cj9_oNQASEMHc/edit?usp=sharing) | [About The Idea](./docs/ABOUT_THE_IDEA.md) | [Presentation Slides](https://github.com/KaviV23/nttc-umhack/blob/main/docs/N%E2%80%99th%20time%E2%80%99s%20the%20charm_Slides.pdf)

---

## 📺 Commercial Video

<video controls src="https://github.com/user-attachments/assets/85ec0d68-355d-49d9-b0b7-d9b2d5692548"></video>

---

## 🚀 Getting Started

### Front-End Setup

Make sure you have the latest Node.js installed:
```bash
node --version
```

Navigate to the frontend directory (if applicable) and install dependencies:
```bash
# cd frontend/  (if you have a separate directory)
npm install
```

Run the front-end server:
```bash
npm run dev
```

### Back-End Setup

You’ll need **Python 3.11+** installed. Then run:
```bash
pipx install uv
```

Navigate to the backend directory (if applicable) and install dependencies using `uv`:
```bash
# cd backend/ (if you have a separate directory)
uv pip install -r requirements.txt
```

**Run the FastAPI Server:**

```bash
fastapi dev .\main.py --port 9000
```

---

## ⚙️ Tech Stack Overview

### Front-End
- **React** with **Mantine** UI framework

### Back-End
- **FastAPI** for API logic and routing
- **Gemini Flash** for cloud-based API LLM integration
- **ipynb** for data analytics
- **polars** for blazingly fast dataframes
  
### Storage
- **PostgreSQL** for persistent relational data
- **CSV files** for lightweight tabular data ingestion/export

### Infrastructure
- **Docker** to containerize services

---

## 📹 Full Featured Walkthrough

<div align="center">

  <p><h3GrabEX MEX Assistant</h3>
  "It all begins with understanding your goals. Our AI reads your intent—whether you're aiming for sales, discounts, or retention—and guides you to the right tools instantly."
  <video controls muted src="https://github.com/user-attachments/assets/9574bc22-2417-4ec8-b476-8083d304d511"></video></p>

</div>
---

## 📚 Documentation & Tutorials

Visit our [docs folder](./docs) for detailed usage and API documentation.

### Troubleshooting

**Check Python & Node Versions**
```bash
python --version
node --version
```

**Reinstall Python Dependencies**
```bash
uv pip install -r requirements.txt
```

**Run in Clean Environment**
```bash
uv venv --recreate
```

---

## 🙌 Contributing

We welcome issues, discussions, and pull requests. Please open a discussion before submitting a large PR.

Make sure to follow our [contributing guidelines](./CONTRIBUTING.md) and test using the `minimal_run.sh` script.

---

## 👏 Acknowledgements

Thanks to the maintainers and toolmakers across the Python and JS ecosystem. Inspired by:
- [FastAPI](https://fastapi.tiangolo.com/)
- [Mantine](https://mantine.dev)
