# Setting up the repository on a Mac

How to get a working copy of this repository on a Mac, with the tools that check its documentation,
from a machine that has none of them. It is written for an engineer who has not set up a software
project before, so each tool is explained when it first appears. Allow about forty minutes, most of
it spent waiting for downloads.

When you are done, you will have:

- the repository on your Mac, and a way to send your changes back to GitHub
- the documentation checker, doc-check, built and passing
- the documentation open in Obsidian, the editor it is written in
- optionally, a check that runs every time you save a change into the repository's history

## Before you start

- **A Mac.** These steps were run on macOS with an Apple-silicon processor. A Linux or Windows
  version of this guide is written once someone runs it on those systems.
- **A GitHub account with access to the repository.** The repository, `jamesberrypersonal/itinero`,
  is private. Ask its owner to invite you, then accept the invitation from the email GitHub sends.
- **Your Mac's login password.** Two of the installers ask for it.

Every command below is typed, or pasted, into Terminal, then run by pressing Return. Where a step
shows what a command prints, your output should match it, apart from version numbers, which may be
newer.

## The steps

### 1. Open Terminal

Terminal is the Mac's command-line app: you type a command, press Return, and
it prints the result. Open Finder, then Applications, then Utilities, and double-click Terminal.
A window opens with a prompt ending in `%`, waiting for a command.

### 2. Install Homebrew

Homebrew installs command-line tools on a Mac, and keeps them up to date.
Run the command from its website, [brew.sh](https://brew.sh):

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

It asks for your Mac's password. Nothing appears on screen while you type it, which is normal.
It also installs Apple's Command Line Tools, which include Git, so it can take several minutes.
When it finishes, it prints a section headed Next steps, holding two or three commands that add
Homebrew to your Terminal. Run each of them, in order. Then quit Terminal and open it again.

Check that Homebrew is ready:

```
brew --version
```

It prints:

```
Homebrew 7.0.13
```

### 3. Check Git

Git keeps the history of every change made to the repository, and sends your
changes to GitHub. Homebrew installed it in the previous step. Check it:

```
git --version
```

It prints:

```
git version 2.50.1 (Apple Git-155)
```

### 4. Sign in to GitHub from Terminal

The repository is private, so Git has to prove who you are
before it can download it. Choose one of the two ways below. The first is quicker and has fewer
ways to go wrong.

**Way A, the GitHub command-line tool.** Install it, then sign in through your web browser:

```
brew install gh
gh auth login
```

`gh auth login` asks four questions. Choose GitHub.com, then HTTPS, then yes to authenticating
Git with your GitHub credentials, then logging in with a web browser. It shows a one-time code,
and opens a browser page where you paste it. Check that you are signed in:

```
gh auth status
```

It prints, with your own username:

```
github.com
  ✓ Logged in to github.com account <your-username> (keyring)
```

**Way B, an SSH key.** An SSH key is a pair of files that proves your Mac is yours, so GitHub
never needs your password. Create a key, using the email address of your GitHub account:

```
ssh-keygen -t ed25519 -C "you@example.com"
```

Press Return to keep the file it suggests. It then asks for a passphrase, which protects the key
if your Mac is lost. Copy the key's public half to the clipboard:

```
pbcopy < ~/.ssh/id_ed25519.pub
```

On GitHub, open Settings, then SSH and GPG keys, then New SSH key. Paste the key, give it a name
such as your Mac's, and save it. Then check that GitHub recognises it:

```
ssh -T git@github.com
```

The first time, it asks whether you are sure you want to continue connecting. Type `yes`. It
then prints, with your own username:

```
Hi <your-username>! You've successfully authenticated, but GitHub does not provide shell access.
```

### 5. Download the repository

Downloading a repository with its whole history is called cloning
it. Make a folder for your projects, and move into it:

```
mkdir -p ~/projects
cd ~/projects
```

If you signed in with way A, clone it with:

```
gh repo clone jamesberrypersonal/itinero
```

If you signed in with way B, clone it with:

```
git clone git@github.com:jamesberrypersonal/itinero.git
```

Either one prints:

```
Cloning into 'itinero'...
```

Move into the repository. Every command from here on is run inside this folder:

```
cd ~/projects/itinero
```

### 6. Install Rust

Rust is the programming language doc-check is written in. Its installer,
rustup, also installs the exact version of Rust that this repository names in
`rust-toolchain.toml`. Run the command from its website, [rustup.rs](https://rustup.rs):

```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

When it asks how to proceed, press Return to choose the standard installation. When it finishes,
quit Terminal, open it again, and move back into the repository:

```
cd ~/projects/itinero
rustc --version
```

The first time, it downloads the version this repository names, which takes a minute. Then it
prints:

```
rustc 1.94.1 (e408947bf 2026-03-25)
```

### 7. Install just

just runs the repository's named commands, such as `just check-docs`, so you
never need to remember the longer commands behind them:

```
brew install just
```

If you would rather not use Homebrew for it, `cargo install just` builds it with Rust instead.
That takes a few minutes longer. Check it either way:

```
just --version
```

It prints:

```
just 1.59.0
```

### 8. Check the documentation

doc-check reads every document in `docs/`, and reports each place a
document breaks the rules in `docs/documentation-system.md`. The first run builds it, which takes
a few seconds:

```
just check-docs
```

It prints:

```
doc-check: clean
```

When a document breaks a rule, doc-check prints one line for it instead, naming the file, the
line, the rule, and what would fix it.

### 9. Run doc-check's own tests

You need this step only if you will change doc-check itself, in
`tools/doc-check/`:

```
just test-docs
```

It prints several lines, and ends with three lines like these, each saying `ok` and `0 failed`:

```
test result: ok. 15 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 14 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.12s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.15s
```

### 10. Optionally, check the documentation before every commit

A commit is one saved change in
the repository's history. A pre-commit hook is a script Git runs before each commit, and this
one runs `just check-docs`. It refuses the commit if any document breaks a rule, or if doc-check
cannot run at all. Install it:

```
just install-hook
```

It prints:

```
Installed the pre-commit hook. Every commit now runs just check-docs first.
```

From then on, a commit that would add a broken document is refused, with the reason:

```
docs/broken.md:3: links: link target nothing.md does not resolve to a file or directory in the vault. (documentation-system.md, "Markdown rules")
doc-check: 1 finding in 1 file
error: recipe `check-docs` failed on line 5 with exit code 1
pre-commit: the commit is refused. Fix the findings above, then commit again.
```

### 11. Install Obsidian, and open the documentation in it

Obsidian is the editor the
documentation is written in. It shows each document formatted, and follows the links between
them. Install it with Homebrew, or download it from [obsidian.md](https://obsidian.md):

```
brew install --cask obsidian
```

Open Obsidian, choose Open folder as vault, and choose the `docs` folder inside
`~/projects/itinero`. A vault is Obsidian's name for a folder of documents it manages.

### 12. Set Obsidian's three settings

Each one keeps the links Obsidian writes working on GitHub
as well, and `docs/documentation-system.md` says why. Open Settings, from the gear at the
bottom left, and set:

| Section | Setting | Set to |
|---|---|---|
| Files and links | `Use [[Wikilinks]]` | Off |
| Files and links | New link format | Path from current file |
| Editor | Strict line breaks | On |

Obsidian saves them in `docs/.obsidian/app.json`, which stays on your Mac and is never
committed. Check them from Terminal:

```
cat docs/.obsidian/app.json
```

It prints these three lines among any others:

```
  "useMarkdownLinks": true,
  "newLinkFormat": "relative",
  "strictLineBreaks": true
```

## Confirming the setup

Quit Terminal, open it again, and run:

```
cd ~/projects/itinero
just check-docs
```

It prints `doc-check: clean`. In Obsidian, open `README.md` from the file list on the left, and
click one of its links: Obsidian opens the document it names. Both together mean the setup is
complete.

## If something goes wrong

| What you see | What it means, and what to do |
|---|---|
| `command not found: brew` | Homebrew is not yet in your Terminal. Run the Next steps commands its installer printed, then quit Terminal and open it again |
| `command not found: rustc`, or the same for `cargo` or `just` | Terminal was not reopened after the install. Quit it, open it again, and move back into the repository |
| `ERROR: Repository not found.` from `git clone`, or `Could not resolve to a Repository` from `gh repo clone` | Your GitHub account has no access yet. Accept the invitation to the repository, or ask its owner for one |
| `git@github.com: Permission denied (publickey).` | GitHub does not recognise your SSH key. Repeat way B of step 4, and check `ssh -T git@github.com` before cloning |
