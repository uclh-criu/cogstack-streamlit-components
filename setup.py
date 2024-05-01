import setuptools

with open("README.md", "r") as fh:
    long_description = fh.read()

setuptools.setup(
    name="cogstack-streamlit-components",
    version="0.3.1",
    author="Ricardo Rodriguez",
    author_email="rr@somewhere.co.uk",
    description="A collection of streamlit components",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/uclh-criu/cogstack-streamlit-components",
    packages=setuptools.find_packages(),
    include_package_data=True,
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    keywords=['Python', 'Streamlit', 'Authentication', 'Components'],
    python_requires=">=3.6",
    install_requires=[
        "streamlit >= 1.25.0",
    ],
)