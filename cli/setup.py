from setuptools import setup

setup(
    name="agentctl",
    version="0.1.0",
    py_modules=["agentctl"],
    package_dir={"": "."},
    install_requires=["typer", "rich", "httpx", "pyyaml"],
    entry_points={"console_scripts": ["agentctl=agentctl:app"]},
)
