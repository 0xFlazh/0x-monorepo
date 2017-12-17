import Dialog from 'material-ui/Dialog';
import FlatButton from 'material-ui/FlatButton';
import {colors} from 'material-ui/styles';
import * as React from 'react';

interface WrappedEthSectionNoticeDialogProps {
    isOpen: boolean;
    onToggleDialog: () => void;
}

export function WrappedEthSectionNoticeDialog(props: WrappedEthSectionNoticeDialogProps) {
    return (
        <Dialog
            title="Dedicated Wrapped Ether Section"
            titleStyle={{fontWeight: 100}}
            actions={[
                <FlatButton
                    key="acknowledgeWrapEthSection"
                    label="Sounds good"
                    onTouchTap={props.onToggleDialog.bind(this)}
                />,
            ]}
            open={props.isOpen}
            onRequestClose={props.onToggleDialog.bind(this)}
            autoScrollBodyContent={true}
            modal={true}
        >
            <div className="pt2" style={{color: colors.grey700}}>
                <div>
                    We have recently updated the Wrapped Ether token used by 0x Portal.
                    Don't worry, unwrapping Ether tied to the old Wrapped Ether token can
                    be done at any time by clicking on the "Wrap ETH" section in the menu
                    to the left.
                </div>
            </div>
        </Dialog>
    );
}
