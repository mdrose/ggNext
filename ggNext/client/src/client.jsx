'use strict'

class QueueHeader extends React.Component {
  constructor(props) {
    super(props)
  }

  render() {
    return (
      <li className="item">
        <div className="col">
          Challenger Name
        </div>
        <div className="col">
          Friend Code
        </div>
        <div className="button">
          Remove?
        </div>
      </li>
    )
  }
}

class QueueItem extends React.Component {
  constructor(props) {
    super(props)
    this.buttonClick = this.buttonClick.bind(this)
  }

  buttonClick() {
    this.props.buttonClick(this.props.userName)
  }

  render() {
    return (
      <li className="item">
        <div className="col">
          {this.props.userName}
        </div>
        <div className="col">
          {this.props.friendCode}
        </div>
        <div className="button">
          <button onClick={this.buttonClick}>Remove</button>
        </div>
      </li>
    )
  }
}

class Queue extends React.Component {
  constructor(props) {
    super(props)
    this.state = {queue: []}
    this.addItem = this.addItem.bind(this)
    this.deleteItem = this.deleteItem.bind(this)
  }

  addItem(userData) {
    this.setState((state) => {
      const queue = state.queue.slice()
      queue.push(userData)
      return {queue}
    })
  }

  deleteItem(userName) {
    fetch(window.location.origin + '/channel/' + channelName + '/queue/' + userName, {method: 'DELETE'})
      .then((resp) => {
        if (resp.ok) {
          this.setState((state) => {
            const queue = state.queue.slice()
            for (const [index, user] of queue.entries()) {
              if (user.name === userName) {
                queue.splice(index, 1)
                break
              }
            }
            return {queue}
          })
        } else {
          alert(`Couldn't delete this user. Server returned ${resp.status}: ${resp.statusText}`)
        }
      }, (err) => alert(`Network error: ${err}`))
  }

  componentDidMount() {
    const channelName = this.props.channelName
    const evtSource = new EventSource(window.location.origin + '/channel/' + channelName + '/queue')
    evtSource.onopen = (e) => { console.log(`Opened: ${JSON.stringify(e)}`) }
    evtSource.onerror = (e) => { console.error(`Error occured: ${JSON.stringify(e)}`) }
    evtSource.addEventListener('fullQueue', (e) => this.setState({queue: JSON.parse(e.data)}))
    evtSource.addEventListener('newChallenger', (e) => this.addItem(JSON.parse(e.data)))
    this.setState({evtSource})
  }

  componentWillUnmount() {
    this.state.evtSource.close()
  }

  render() {
    return (
      <ol>
        <QueueHeader />
        {this.state.queue.length !== 0 && this.state.queue.map((user) =>
          <QueueItem key={user.name} userName={user.name} friendCode={user.friendCode} buttonClick={this.deleteItem}/>
        )}
        {this.state.queue.length === 0 && <p className="center">The queue for this channel is currently empty</p>}
      </ol>
    )
  }
}

const domContainer = document.querySelector('#app')
const channelName = window.location.pathname.split('/')[2]

ReactDOM.render(
  <Queue channelName={channelName}/>,
  domContainer
)
