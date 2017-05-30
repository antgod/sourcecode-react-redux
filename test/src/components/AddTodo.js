import React, { Component, PropTypes } from 'react'

export default class AddTodo extends Component {
  render() {
    return (
      <div>
        <input type='text' ref='input' />
        <button onClick={(e) => this.handleClick(e)}>
          Add
        </button>
        <button onClick={(e) => this.handleClickAsync(e)}>
          AddAsync
        </button>
        <button onClick={(e) => this.handleClickPromise(e)}>
          AddPromise
        </button>
      </div>
    )
  }

  handleClick(e) {
    const node = this.refs.input
    const text = node.value.trim()
    this.props.onAddClick(text)
    node.value = ''
  }

  handleClickAsync(e) {
    const node = this.refs.input
    const text = node.value.trim()
    this.props.onAddClickAsync(text)
    node.value = ''
  }

  handleClickPromise(e) {
    const node = this.refs.input
    const text = node.value.trim()
    this.props.onAddClickPromise(text)
    node.value = ''
  }
}

AddTodo.propTypes = {
  onAddClick: PropTypes.func.isRequired,
  onAddClickAsync: PropTypes.func.isRequired,
}