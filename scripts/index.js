const DEBUG = window.location.hostname.indexOf('localhost') > -1;
let app;
let progress;

const bitbucketToGithub = axios.create({
    baseURL: 'http://127.0.0.1:8000/api',
});

const bitbucket = axios.create({
    baseURL: 'https://api.bitbucket.org/2.0',
});

function log(message) {
    if (DEBUG) {
        console.log(message);
    }
}

function clearHash() {
    if(window.history.pushState) {
        window.history.pushState('', 'Bitbucket to Github', window.location.pathname)
    } else {
        window.location.hash = '';
    }
}

function retrieveBitbucketToken() {
    // #access_token={token}&token_type=bearer
    if (window.location.hash){
        // todo some validation here and possibly remove token from url
        const token = window.location.hash.split('&')[0].substring(14);
        localStorage.setItem('bitbucketToken', token);
        clearHash();
        return token;
    } else if (localStorage.getItem('bitbucketToken')) {
        return localStorage.getItem('bitbucketToken');
    }
}

function retrieveGithubCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
        urlParams.delete('code');
        return code;
    }
}

async function init(token, code) {
    app = new Vue({
        el: '#app',
        data: {
            token: token,
            code: code,
            userInfo: {},
            loginInfo: {},
            loading: false,
            loadingMessage: 'Loading',
            repos: {},
            githubLoading: false,
            transfersInProgress: [],
            bitbucketClientId: DEBUG ? 'YtBjgbYwHyRqN7ZPjw' : 'WuuJR7NpJybXLPpyvt',
            githubClientId: DEBUG ? 'Iv1.7e7b7b4572147e74': 'Iv1.6610d944be6fe1d1',
        },
        computed: {
            loggedIn: function () {
                return !!this.token;
            },
        },
        watch: {

        },
        methods: {
            getUserInfo: async function () {
                this.loading = true;
                this.loadingMessage = 'Logging you in';
                try {
                    const response = await bitbucket.get(`/user?access_token=${this.token}`);
                    this.userInfo = response.data;

                    const result = await bitbucketToGithub.post('/login/', {
                        "username": this.userInfo.username,
                        "bitbucket_token": this.token,
                    });
                    this.loginInfo = result.data;
                    progress = setInterval(app.inProgress, 5000);
                } catch (e) {
                    this.logout();
                } finally {
                    this.loading = false;
                }

            },
            retrieveGithubAuthToken: async function() {
                if (!this.loginInfo.githubAuthenticated && this.code) {
                    this.githubLoading = true;
                    try {
                        const response = await bitbucketToGithub.post('/authorize-github/', {code: this.code}, {headers: {'Authorization': `Bearer ${this.loginInfo.token}`}});
                        this.loginInfo.githubAuthenticated = true;
                    } catch (e) {
                        this.loginInfo.githubAuthenticated = false;
                    } finally {
                        this.githubLoading = false;
                    }
                }
            },
            getUserRepos: async function(pageUrl) {
                this.loading = true;
                this.loadingMessage = 'Fetching your Bitbucket Repos';
                try {
                    let response;
                    if (pageUrl) {
                        response = await axios.get(`${pageUrl}?access_token=${this.token}&role=owner`);
                    } else {
                        response = await bitbucket.get(`/repositories/${this.userInfo.username}?access_token=${this.token}&role=owner`);
                    }
                    this.repos = response.data;
                } catch (e) {
                    // todo some kind of notification
                    if (e.response.status === 401) this.logout();
                } finally {
                    this.loading = false;
                }
            },
            copy: async function(repoSlug, repoName) {
                // todo disable button
                this.loading = true;
                this.loadingMessage = `Queueing up ${repoName}`;

                try {
                    const result = await bitbucketToGithub.post(`/copy/${repoSlug}/`, undefined, {headers: {'Authorization': `Bearer ${this.loginInfo.token}`}});
                } catch (e) {
                    // todo improve this
                    log(e);
                } finally {
                    this.loading = false;
                }
            },
            showStatus: function(progress) {
                if (progress.running) {
                    return 'Running';
                }

                if (progress.queued) {
                    return 'Queued';
                }

                if (progress.message === 'Done.'){
                    return 'Complete';
                }

                return 'Retry';
            },
            inProgress: async function() {
                try {
                    const result = await bitbucketToGithub.get(`/in-progress/`, {headers: {'Authorization': `Bearer ${this.loginInfo.token}`}});
                    this.transfersInProgress = result.data.items;
                } catch (e) {
                    // todo improve this
                    log(e);
                } finally {
                    this.loading = false;
                }
            },
            logout: async function () {
                this.loading = true;
                this.loadingMessage = "Logging you out";
                try {
                    if (this.loginInfo.token) {
                        const result = await bitbucketToGithub.post('/logout/', undefined, {headers: {'Authorization': `Bearer ${this.loginInfo.token}`}});
                    }
                    localStorage.removeItem('bitbucketToken');
                    this.token = undefined;
                    this.userInfo= {};
                    this.code = undefined;
                    this.loginInfo= {};
                    this.loadingMessage= 'Loading';
                    this.repos = {};
                    this.githubLoading= false;
                    clearInterval(progress);
                } catch (e) {
                    // logout failed
                    log(e);
                } finally {
                    this.loading = false;
                }
            }
        }
    });
    if (token) {
        await app.getUserInfo();
        await app.retrieveGithubAuthToken();
    }
}

window.addEventListener("load", function(){
    const token = retrieveBitbucketToken();
    const code = retrieveGithubCode();
    init(token, code);
});
