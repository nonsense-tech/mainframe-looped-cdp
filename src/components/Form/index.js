import React, { Component } from 'react';
import {
  Col,
  InputNumber,
  Form,
} from 'antd';

import './index.scss';

class CustomForm extends Component {
  validateEthValue = (rule, value, callback) => {
    const { max: maxEthValue } = this.props.ethValue;
    if (value && value <= maxEthValue) {
      callback();
    } else {
      callback(`The Looper has a limit of ${maxEthValue} ETH per transaction.`);
    }
  }
  validatePercentValue = (rule, value, callback) => {
    const { 
      min: minPercentValue,
      max: maxPercentValue,
    } = this.props.percentValue;
    if (value && value >= minPercentValue && value <= maxPercentValue) {
      callback();
    } else {
      callback(`Rate must be between ${minPercentValue}% and ${maxPercentValue}%`);
    }
  }
  render() {
    const {
      form: {
        getFieldDecorator,
      },
      ethValue: {
        initial: initialEthValue,
      },
      percentValue: {
        initial: initialPercentValue,
      },
      changeEthValue,
      changePercentValue,
    } = this.props;
    return (
      <div className="form-container">
        <Form>
          <Col span={11}>
            <Form.Item label="ETH to lock">
              {getFieldDecorator('ethValue', {
                rules: [{
                  validator: this.validateEthValue,
                }],
                initialValue: initialEthValue,
              })(
                <InputNumber
                  formatter={value => `⧫ ${value}`}
                  parser={value => value.replace('⧫', '')} 
                  onChange={changeEthValue}
                  className="input"
                  size="large"
                  step={0.01}
                />
              )}
            </Form.Item>
          </Col>
          <Col span={2} />
          <Col span={11}>
            <Form.Item label="Rehypothecation rate">
              {getFieldDecorator('percentValue', {
                rules: [{
                  validator: this.validatePercentValue,
                }],
                initialValue: initialPercentValue,
              })(
                <InputNumber
                  formatter={value => `${value} %`}
                  parser={value => value.replace('%', '')}
                  onChange={changePercentValue}
                  className="input"
                  size="large"
                  step={10}
                />
              )}
            </Form.Item>
          </Col>
        </Form>
      </div>
    );
  }
}

export default Form.create({ name: 'register' })(CustomForm);
